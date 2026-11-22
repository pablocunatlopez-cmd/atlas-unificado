import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileAtlasWorld} from './atlas-world-compiler.mjs';
import {exportLiaMeshGltf} from './lia-gltf-mesh-export.mjs';
test('generate glTF with embedded binary geometry and valid buffer offsets',()=>{
 const w=compileAtlasWorld({id:'demo',title:'Demo',objects:[
  {id:'floor',kind:'terrain',position:[0,0,0],scale:[10,1,10]},
  {id:'house',kind:'building',position:[3,1,0]},
  {id:'sun',kind:'light',position:[0,5,0]}]});
 const gltf=exportLiaMeshGltf(w);
 assert.equal(gltf.meshes.length,2);
 assert.equal(gltf.nodes[0].mesh,0);
 assert.equal(gltf.nodes[1].mesh,1);
 assert.equal(gltf.nodes[2].mesh,undefined);
 assert.equal(gltf.extras.meshesGenerated,true);
 const bin=Buffer.from(gltf.buffers[0].uri.split(',')[1],'base64');
 assert.equal(bin.length,gltf.buffers[0].byteLength);
 for(const view of gltf.bufferViews)assert.ok(view.byteOffset+view.byteLength<=bin.length);
 assert.equal(gltf.accessors[0].count,8);
 assert.equal(gltf.accessors[1].count,36);
});
test('no primitive geometry means no misleading meshes',()=>{
 const w=compileAtlasWorld({id:'empty',title:'Empty',objects:[{id:'sun',kind:'light',position:[0,0,0]}]});
 const gltf=exportLiaMeshGltf(w);
 assert.equal(gltf.extras.meshesGenerated,false);
 assert.equal(gltf.meshes,undefined);
});
