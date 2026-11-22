"""Bake CC0 ERAS avatar geometry into compact static standing and seated GLBs.

From the repository root: blender -b -t 2 --python scripts/build-resident-lod.py
The renderer owns motion and role identity. These meshes have no animation or rig.
"""
from hashlib import sha256
import json
from pathlib import Path
import re

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
AVATARS = ROOT / 'public/house/assets/models/avatar'
OUTPUT = ROOT / 'public/house/assets/models/lod'
EXPOSED = re.compile(r'^(head|neck|wrist|finger|metacarpal|eye|orbic|jaw|special|temporalis|levator|risor|bucc|tongue|oculi|oris)')
TRIANGLES = {'skin': 1280, 'tunic': 700, 'trousers': 450, 'boots': 270, 'hair': 540, 'eyes': 192, 'eyebrows': 80}
SURFACES = {
    'skin': ((.54, .33, .24), .67), 'tunic': ((.13, .24, .23), .88),
    'trousers': ((.068, .094, .112), .92), 'boots': ((.03, .044, .048), .65),
    'hair': ((.126, .082, .055), .79), 'eyes': ((.49, .49, .43), .27),
    'eyebrows': ((.13, .08, .06), .9),
}


def align(rig, first, second, direction):
    bone = rig.pose.bones[first]
    child = rig.pose.bones[second]
    target = Vector(direction).normalized()
    current = (child.head - bone.head).normalized()
    if current.length < 1e-5:
        raise ValueError(f'Degenerate bone segment: {first}')
    pose = current.rotation_difference(target).to_matrix().to_4x4() @ bone.matrix
    pose.translation = bone.head
    bone.matrix = pose
    bpy.context.view_layer.update()


def set_pose(rig, seated):
    for side, sign in [('L', 1), ('R', -1)]:
        if seated:
            align(rig, f'upperleg01_{side}', f'lowerleg01_{side}', (.045 * sign, -1, -.14))
            align(rig, f'lowerleg01_{side}', f'foot_{side}', (.015 * sign, .04, -1))
            align(rig, f'foot_{side}', f'toe2-1_{side}', (.05 * sign, -1, -.22))
        align(rig, f'upperarm02_{side}', f'lowerarm01_{side}', (.18 * sign, -.12 if seated else -.04, -1))
        align(rig, f'lowerarm01_{side}', f'wrist_{side}', (-.17 * sign, -.90, -.31) if seated else (-.09 * sign, -.15, -1))


def trim_under_clothing(obj):
    exposed = {v.index for v in obj.vertex_groups if EXPOSED.search(v.name)}
    visible = {v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if g.group in exposed) > .18}
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not any(v.index in visible for v in f.verts)], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(obj.data)
    finally:
        bm.free()
    obj.data.update()


def texture(material, filename, size, alpha='OPAQUE'):
    # Create a compact embedded copy and preserve the source image orientation.
    image = bpy.data.images.load(str(AVATARS / filename), check_existing=False)
    image.scale(size, size)
    image.file_format = 'PNG'
    image.pack()
    nodes = material.node_tree.nodes
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    material.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
    if alpha == 'MASK':
        # glTF export recognizes binary alpha from a Greater Than node.
        cutoff = nodes.new('ShaderNodeMath')
        cutoff.operation = 'GREATER_THAN'
        cutoff.inputs[1].default_value = .28
        material.node_tree.links.new(tex.outputs['Alpha'], cutoff.inputs[0])
        material.node_tree.links.new(cutoff.outputs[0], shader.inputs['Alpha'])


def surface(part, sex):
    color, roughness = SURFACES[part]
    material = bpy.data.materials.new(part)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    if part == 'skin':
        texture(material, f'{sex}-skin.png', 256)
    elif part == 'hair':
        texture(material, 'braid01.png' if sex == 'female' else 'short02.png', 128, 'MASK')
    elif part == 'eyes':
        texture(material, 'eyes.png', 128)
    elif part == 'eyebrows':
        texture(material, 'eyebrows.png', 64, 'MASK')
    return material


def bake_part(source, name, sex):
    if name == 'skin':
        trim_under_clothing(source)
    # Collapse only after trim, while the vertex groups still identify exposed skin.
    # Skinning is evaluated first so each exported pose is the actual clothed shape.
    modifier = source.modifiers.new('Asset triangle budget', 'DECIMATE')
    modifier.use_collapse_triangulate = True
    modifier.ratio = min(1, TRIANGLES[name] / len(source.data.polygons))
    deps = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(deps)
    mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=deps)
    mesh.transform(evaluated.matrix_world)
    mesh.materials.clear()
    mesh.materials.append(surface(name, sex))
    for polygon in mesh.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True
    obj = bpy.data.objects.new('LOD_' + name, mesh)
    obj['anatomyPart'] = name
    bpy.context.collection.objects.link(obj)
    return obj


def build(sex, pose):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = AVATARS / f'{sex}.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    for original_material in bpy.data.materials:
        original_material.name = 'SOURCE_' + original_material.name
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    set_pose(rig, pose == 'seated')
    hair = {'female': 'hair_long', 'male': 'hair_short'}[sex]
    parts = {o.get('anatomyPart'): o for o in bpy.context.scene.objects if o.type == 'MESH'}
    objects = [bake_part(parts[part if part != 'hair' else hair], part, sex) for part in TRIANGLES]
    floor = min(v.co.z for v in next(o for o in objects if o.get('anatomyPart') == 'boots').data.vertices)
    file = OUTPUT / f'{sex}-{pose}.glb'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        for vertex in obj.data.vertices:
            vertex.co.z -= floor
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(file), export_format='GLB', use_selection=True, export_extras=True, export_animations=False, export_skins=False, export_yup=True)
    for obj in objects:
        obj.data.calc_loop_triangles()
    return {
        'file': file.name, 'template': sex, 'pose': pose, 'sha256': sha256(file.read_bytes()).hexdigest(),
        'source': f'../avatar/{source.name}', 'sourceSha256': sha256(source.read_bytes()).hexdigest(),
        'triangles': sum(len(obj.data.loop_triangles) for obj in objects),
        'height': round(max(v.co.z for obj in objects for v in obj.data.vertices), 4),
        'parts': [obj.get('anatomyPart') for obj in objects],
    }


if __name__ == '__main__':
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        'sourceLicense': 'CC0-1.0', 'licenseFile': '../avatar/CC0-LICENSE.md',
        'generator': f'Blender {bpy.app.version_string} CPU · scripts/build-resident-lod.py',
        'forward': '+Z', 'up': '+Y', 'floorY': 0, 'standingScaleReference': 1.84,
        'assets': [build(sex, pose) for sex in ('female', 'male') for pose in ('standing', 'seated')],
    }
    (OUTPUT / 'provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
