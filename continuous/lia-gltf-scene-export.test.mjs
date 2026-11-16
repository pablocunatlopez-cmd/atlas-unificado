import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileAtlasWorld} from './atlas-world-compiler.mjs';
import {exportLiaGltfScene} from './lia-gltf-scene-export.mjs';
test('export glTF 2 skeleton with transform nodes and no fake geometry',()=>{
 const w=compileAtlasWorld({id:'forest',title:'Forest',objects:[
  {id:'tree',kind:'tree',position:[1,2,3],rotation:[0,0,0],scale:[2,2,2]}]});
 const gltf=exportLiaGltfScene(w);
 assert.equal(gltf.asset.version,'2.0');
 assert.equal(gltf.nodes.length,1);
 assert.deepEqual(gltf.nodes[0].translation,[1,2,3]);
 assert.deepEqual(gltf.nodes[0].rotation,[0,0,0,1]);
 assert.equal(gltf.extras.meshesGenerated,false);
 assert.equal(gltf.nodes[0].extras.geometryGenerated,false);
 assert.equal(JSON.parse(JSON.stringify(gltf)).scene,0);
});
test('reject invalid glTF inputs',()=>assert.throws(()=>exportLiaGltfScene({schema:'wrong',objects:[]})));
