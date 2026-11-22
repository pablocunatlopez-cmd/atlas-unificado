import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileAtlasWorld,atlasWorldSceneSummary} from './atlas-world-compiler.mjs';
test('compile deterministic editable world without claiming a render',()=>{
 const spec={id:'eras-forest',title:'Bosque de ERAS',objects:[
  {id:'ground',kind:'terrain',position:[0,0,0],scale:[100,1,100]},
  {id:'oak',kind:'tree',position:[4,0,2],asset:'assets/oak.glb'},
  {id:'sun',kind:'light',position:[0,20,0]}]};
 const a=compileAtlasWorld(spec),b=compileAtlasWorld(spec);
 assert.deepEqual(a,b);
 assert.equal(a.renderExecuted,false);
 assert.equal(a.editable,true);
 assert.equal(atlasWorldSceneSummary(a).counts.tree,1);
});
test('reject duplicates, malformed vectors, path traversal and external asset URLs',()=>{
 const base={id:'w',title:'World',objects:[{id:'x',kind:'tree',position:[0,0,0]}]};
 assert.throws(()=>compileAtlasWorld({...base,objects:[base.objects[0],base.objects[0]]}));
 assert.throws(()=>compileAtlasWorld({...base,objects:[{...base.objects[0],position:[Infinity,0,0]}]}));
 assert.throws(()=>compileAtlasWorld({...base,objects:[{...base.objects[0],asset:'../secret'}]}));
 assert.throws(()=>compileAtlasWorld({...base,objects:[{...base.objects[0],asset:'https://example.com/a.glb'}]}));
 assert.throws(()=>compileAtlasWorld({...base,objects:[{...base.objects[0],scale:[0,1,1]}]}));
});
