import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasAssetRegistry} from './eras-asset-registry.mjs';
import {createValidatedErasRenderer} from './eras-validated-renderer.mjs';
const node=(asset='')=>({id:'tree',type:'mesh',parent:null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],asset});
test('preflight blocks invalid scenes before any render calls',async()=>{
 const calls=[];
 const bridge=createValidatedErasRenderer({
  create:async n=>calls.push('create:'+n.id),
  update:async()=>{},destroy:async()=>{}
 },createErasAssetRegistry());
 await assert.rejects(bridge.sync({schemaVersion:1,nodes:[node('missing')]}));
 assert.deepEqual(calls,[]);
 await bridge.sync({schemaVersion:1,nodes:[node()]});
 assert.deepEqual(calls,['create:tree']);
});
