#!/usr/bin/env python3
"""Derive 4K resident textures from the bundled MakeHuman CC0 UV atlases."""

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


SIZE = 4096
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/house/assets/models/avatar'
OUTPUT = ROOT / 'public/house/assets/models/ultra'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def authored_image(name, expected_hashes):
    path = SOURCE / name
    actual = sha256(path)
    if actual != expected_hashes[name]:
        raise ValueError(f'Unrecognized source texture: {name}')
    with Image.open(path) as source:
        image = source.convert('RGB')
    return image, {'path': '../avatar/' + name, 'sha256': actual, 'size': list(image.size)}


def smooth_field(random, width):
    samples = random.integers(0, 256, size=(width, width), dtype=np.uint8)
    field = Image.fromarray(samples).resize((SIZE, SIZE), Image.Resampling.BICUBIC)
    return np.asarray(field, dtype=np.float32) / 255 - .5


def follicle_field(random, cell, radius):
    """Sample irregularly spaced, soft depressions at the output resolution."""
    grid = (SIZE + cell - 1) // cell + 2
    x = np.arange(SIZE, dtype=np.float32)[None, :]
    columns = (x.astype(np.intp) // cell) + 1
    shift_x = random.uniform(.13, .87, size=(grid, grid)).astype(np.float32)
    shift_y = random.uniform(.13, .87, size=(grid, grid)).astype(np.float32)
    amplitudes = random.uniform(0, 1, size=(grid, grid)).astype(np.float32) ** 2
    radii = random.uniform(.65, 1.35, size=(grid, grid)).astype(np.float32) * radius
    result = np.empty((SIZE, SIZE), dtype=np.float32)
    # Strips keep memory bounded. Neighbor cells prevent visible grid seams.
    for start in range(0, SIZE, 96):
        end = min(start + 96, SIZE)
        y = np.arange(start, end, dtype=np.float32)[:, None]
        rows = y.astype(np.intp) // cell + 1
        pores = np.zeros((end - start, SIZE), dtype=np.float32)
        for dy, dx in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1),
                       (-1, -1), (-1, 1), (1, -1), (1, 1)):
            row, column = rows + dy, columns + dx
            px = (column - 1 + shift_x[row, column]) * cell
            py = (row - 1 + shift_y[row, column]) * cell
            distance = ((x - px) ** 2 + (y - py) ** 2) / (radii[row, column] ** 2)
            pores += amplitudes[row, column] * np.maximum(0, 1 - distance) ** 2
        result[start:end] = np.minimum(pores, 1)
    return result


def write_webp(data, path, quality):
    Image.fromarray(data).save(path, format='WEBP', quality=quality, method=6)
    return {'file': path.name, 'sha256': sha256(path), 'size': [SIZE, SIZE],
            'bytes': path.stat().st_size}


def build(template, seed, expected_hashes):
    random = np.random.default_rng(seed)
    albedo, albedo_source = authored_image(template + '-skin.png', expected_hashes)
    authored_normal, normal_source = authored_image(template + '-normal.webp', expected_hashes)
    albedo = np.asarray(albedo.resize((SIZE, SIZE), Image.Resampling.LANCZOS))
    authored_normal = np.asarray(authored_normal.resize((SIZE, SIZE), Image.Resampling.BICUBIC))

    pores = follicle_field(random, 5, 1.9)
    freckles = follicle_field(random, 22, 3.6)
    pattern = smooth_field(random, 147) * 5.2 + smooth_field(random, 741) * 3.4
    detailed = np.empty_like(albedo)
    normals = np.empty_like(authored_normal)
    for start in range(0, SIZE, 96):
        end = min(start + 96, SIZE)
        color = albedo[start:end].astype(np.float32)
        shade = pattern[start:end] - 7.5 * pores[start:end] - 5.0 * freckles[start:end]
        # Limit treatment in already dark regions such as ear folds and nostrils.
        shade *= np.clip((color[..., 0] - 85) / 120, .12, 1)
        color += shade[..., None] * np.array([.79, 1, 1.14], dtype=np.float32)
        detailed[start:end] = np.rint(color).clip(0, 255).astype(np.uint8)

        # Finite differences add UV-aligned pore relief while retaining broad
        # structure from the normal map's authored coordinate system.
        sample = pores[np.arange(start - 1, end + 1).clip(0, SIZE - 1)]
        dx = np.roll(sample[1:-1], -1, axis=1) - np.roll(sample[1:-1], 1, axis=1)
        dy = sample[2:] - sample[:-2]
        value = authored_normal[start:end].astype(np.float32) / 127.5 - 1
        value[..., 0] += dx * .22
        value[..., 1] -= dy * .22
        value[..., 2] = np.maximum(value[..., 2], .06)
        value /= np.linalg.norm(value, axis=2, keepdims=True)
        normals[start:end] = np.rint((value + 1) * 127.5).clip(0, 255).astype(np.uint8)

    color_record = write_webp(detailed, OUTPUT / (template + '-skin.webp'), 88)
    normal_record = write_webp(normals, OUTPUT / (template + '-normal.webp'), 90)
    return [dict(color_record, template=template, usage='sRGB albedo', source=albedo_source),
            dict(normal_record, template=template, usage='linear tangent normal', source=normal_source)]


def main():
    source = json.loads((SOURCE / 'sources.json').read_text())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assets = []
    for template, seed in [('female', 126129), ('male', 217731)]:
        assets.extend(build(template, seed, source['files']))
    provenance = {
        'license': source['license'],
        'upstreamAuthors': source['author'],
        'sourceLicense': '../avatar/CC0-LICENSE.md',
        'sourceManifest': '../avatar/sources.json',
        'generator': 'scripts/build-ultra-skin.py',
        'description': ('UV-aligned 4096 × 4096 albedo and normal maps. The authored 2K albedo '
                        'and 1K normal were resampled. Organic pigmentation and pore relief were '
                        'then calculated at 4K. The anatomy, skin UVs and original color remain.'),
        'assets': assets,
    }
    (OUTPUT / 'provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
    for asset in assets:
        print(asset['file'], asset['bytes'], asset['sha256'])


if __name__ == '__main__':
    main()
