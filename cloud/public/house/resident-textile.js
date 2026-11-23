import * as THREE from './vendor/three.module.js';

const size = 128;
const strands = 16;

function textileTexture(pixels) {
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // The two tunic meshes have about 8 meters of surface per UV unit.
  // 16 strands × 256 repeats gives a pitch near 2 millimeters.
  texture.repeat.set(256, 256);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createResidentTextileMaps() {
  const height = new Float32Array(size * size);
  const normal = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const warp = Array.from({length: size}, (_, i) => Math.cos(Math.PI * (i + .5) * strands / size));
  const ribs = warp.map(value => value ** 8);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Warp and weft alternate which thread passes over the crossing.
    const over = warp[x] * warp[y];
    height[y * size + x] = ribs[x] * (.36 + .17 * over) + ribs[y] * (.36 - .17 * over);
  }

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    const dx = height[y * size + (x + 1) % size] - height[y * size + (x + size - 1) % size];
    const dy = height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x];
    const z = 1 / Math.hypot(dx, dy, 1);
    normal.set([Math.round(127.5 * (1 - dx * z)), Math.round(127.5 * (1 - dy * z)), Math.round(127.5 * (1 + z)), 255], index * 4);
    const fiber = Math.round(250 - 32 * height[index]);
    roughness.set([fiber, fiber, fiber, 255], index * 4);
  }

  return { fabricNormal: textileTexture(normal), fabricRoughness: textileTexture(roughness) };
}
