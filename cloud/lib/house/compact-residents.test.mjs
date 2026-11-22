import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3, Color, Matrix4, Scene } from '../../public/house/vendor/three.module.js';
import { GLTFLoader } from '../../public/house/vendor/GLTFLoader.js';
import { createProcessCreatures } from '../../public/house/process-creatures.js';
import { residentAppearance } from '../../public/house/resident-appearance.js';
import { RESIDENTS } from '../../public/house/residents.js';

const directory = new URL('../../public/house/assets/models/lod/', import.meta.url);
const variants = ['female-standing', 'female-seated', 'male-standing', 'male-seated'];
const roles = ['skin', 'tunic', 'trousers', 'boots', 'hair', 'eyes', 'eyebrows'];
const humans = RESIDENTS.filter(resident => resident.archetype === 'human');

function glbDocument(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
  return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
}

test('shipped compact CC0 avatars contain the authored anatomy, pose and embedded materials', async () => {
  const manifest = JSON.parse(await readFile(new URL('provenance.json', directory), 'utf8'));
  assert.equal(manifest.sourceLicense, 'CC0-1.0');
  assert.ok((await readFile(new URL(manifest.licenseFile, directory), 'utf8')).includes('CC0'));
  assert.deepEqual(manifest.assets.map(asset => asset.file.replace(/\.glb$/, '')).sort(), variants.slice().sort());

  const heights = new Map();
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(asset.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    const source = await readFile(new URL(asset.source, directory));
    assert.equal(createHash('sha256').update(source).digest('hex'), asset.sourceSha256);
    const glb = glbDocument(bytes);
    assert.equal(glb.skins, undefined);
    assert.equal(glb.animations, undefined);
    assert.equal(glb.images.length, 4);
    assert.ok(bytes.length < 300_000, `${asset.file} must stay usable on mobile`);
    assert.ok(glb.images.every(image => Number.isInteger(image.bufferView) && !image.uri));
    assert.ok(glb.buffers.every(buffer => !buffer.uri));

    const meshes = glb.nodes.filter(node => Number.isInteger(node.mesh));
    assert.deepEqual(meshes.map(node => node.extras.anatomyPart).sort(), roles.slice().sort());
    let triangles = 0;
    let lowest = Infinity;
    let highest = -Infinity;
    for (const node of meshes) {
      for (const primitive of glb.meshes[node.mesh].primitives) {
        const position = glb.accessors[primitive.attributes.POSITION];
        const normal = glb.accessors[primitive.attributes.NORMAL];
        const uv = glb.accessors[primitive.attributes.TEXCOORD_0];
        assert.equal(glb.materials[primitive.material].name, node.extras.anatomyPart);
        assert.equal(normal.count, position.count);
        assert.equal(uv.count, position.count);
        lowest = Math.min(lowest, position.min[1]);
        highest = Math.max(highest, position.max[1]);
        triangles += glb.accessors[primitive.indices].count / 3;
        if (asset.pose === 'seated' && node.extras.anatomyPart === 'boots') {
          assert.ok(position.min[2] > .25, 'seated shoes rest forward of the seat');
        }
      }
    }
    assert.ok(Math.abs(lowest) < .002, `${asset.file} keeps its foot contact on the floor`);
    assert.ok(triangles > 2_500 && triangles <= 4_000);
    assert.equal(triangles, asset.triangles);
    assert.ok(Math.abs(highest - asset.height) < .0001);
    heights.set(`${asset.template}-${asset.pose}`, highest);
  }
  for (const template of ['female', 'male']) {
    assert.ok(heights.get(`${template}-standing`) - heights.get(`${template}-seated`) > .3);
  }
});

test('the overview renders every canonical human with the compact meshes when both detailed slots are unavailable', { timeout: 5000 }, async t => {
  const savedGlobals = new Map(['self', 'createImageBitmap', 'document'].map(name => [name, globalThis[name]]));
  globalThis.self = globalThis;
  // Node lacks a browser image decoder. GLTFLoader still parses real geometry
  // and embedded PNG payloads. The stand-in supplies the decoded dimensions.
  globalThis.createImageBitmap = async blob => {
    const png = Buffer.from(await blob.arrayBuffer());
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  };
  const canvasContext = new Proxy({}, { get: () => () => {}, set: () => true });
  globalThis.document = { createElement: () => ({ getContext: () => canvasContext }) };
  const scene = new Scene();
  const textures = [];
  const loaded = new Set();
  const creatures = createProcessCreatures(scene, textures, {
    characterMeshes: true,
    async loadCompact(variant) {
      assert.ok(variants.includes(variant));
      const glb = await readFile(new URL(variant + '.glb', directory));
      const parsed = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
      loaded.add(variant);
      return parsed.scene;
    }
  });

  t.after(() => {
    creatures.dispose();
    for (const texture of textures) texture.dispose();
    for (const [name, value] of savedGlobals) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  creatures.setPeopleBudget(0);
  while (creatures.peopleStatus().compact.loading && !t.signal.aborted) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.deepEqual([...loaded].sort(), variants.slice().sort());
  assert.deepEqual(creatures.peopleStatus().compact, { loaded: 4, loading: false, failed: false });

  creatures.update(1, { position: { x: 0, y: 20, z: 0 } });
  const compact = scene.getObjectByName('atlas-compact-residents');
  const boxes = scene.getObjectByName('atlas-process-bodies');
  const matrix = new Matrix4();
  assert.equal(compact.children.length, humans.length);
  assert.deepEqual(creatures.peopleStatus().active, []);
  for (const human of humans) {
    const actor = compact.children.find(child => child.userData.residentId === human.id);
    assert.ok(actor?.visible, human.id);
    assert.deepEqual(actor.position.toArray(), human.position);
    const appearance = residentAppearance(human.id);
    assert.deepEqual(actor.userData.functionIds, appearance.functionIds);
    const tunic = actor.children.find(part => part.userData.anatomyPart === 'tunic');
    const skin = actor.children.find(part => part.userData.anatomyPart === 'skin');
    assert.ok(tunic?.material.color.equals(new Color(appearance.uniform)), human.id);
    assert.equal(skin?.material.map.image.width, 256);
    const floor = new Box3().setFromObject(actor, true).min.y;
    assert.ok(Math.abs(floor - human.position[1]) < .002);
    const firstPart = RESIDENTS.indexOf(human) * boxes.userData.parts;
    for (let part = 0; part < boxes.userData.parts; part++) {
      boxes.getMatrixAt(firstPart + part, matrix);
      assert.equal(matrix.elements[13], -30, `${human.id} has no visible box fallback`);
    }
  }
});
