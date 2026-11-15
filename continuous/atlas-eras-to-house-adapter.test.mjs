import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileAtlasErasScene} from './atlas-eras-engine-bridge.mjs';
import {atlasErasManifestToSceneGraph} from './atlas-eras-to-house-adapter.mjs';

test('adapts compiled ERAS chunks into a deterministic parented scene graph',()=>{
 const manifest=compileAtlasErasScene({
  id:'house-demo',seed:7,world:{chunkSize:32,radius:1,maxChunks:1,vegetation:4}
 });
 const scene=atlasErasManifestToSceneGraph(manifest);
 assert.deepEqual(scene,atlasErasManifestToSceneGraph(manifest));
 assert.equal(scene.nodes.length,6);
 assert.equal(scene.nodes[0].id,'eras-root');
 assert.equal(scene.nodes[1].parent,'eras-root');
 assert.ok(scene.nodes.slice(2).every(node=>node.parent===scene.nodes[1].id));
 assert.ok(scene.nodes.slice(2).every(node=>['tree','rock'].includes(node.primitive)));
 assert.ok(scene.nodes.slice(2).every(node=>node.position.every(Number.isFinite)));
});

test('rejects malformed or oversized manifests before rendering',()=>{
 const manifest=compileAtlasErasScene({world:{radius:0,maxChunks:1,vegetation:1}});
 assert.throws(()=>atlasErasManifestToSceneGraph({...manifest,engine:'other'}),/manifest/);
 assert.throws(()=>atlasErasManifestToSceneGraph(manifest,{maxNodes:2}),/budget/);
 const emptyChunks={...manifest,chunks:Array.from({length:5},(_,index)=>({
  chunk:[index,0],objects:[]
 }))};
 assert.throws(()=>atlasErasManifestToSceneGraph(emptyChunks,{maxNodes:3}),/budget/);
 const malformed=structuredClone(manifest);
 malformed.chunks[0].objects[0].position[0]=Infinity;
 assert.throws(()=>atlasErasManifestToSceneGraph(malformed),/object/);
});
