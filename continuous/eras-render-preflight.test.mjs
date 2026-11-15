import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasAssetRegistry} from './eras-asset-registry.mjs';
import {validateErasRenderSnapshot} from './eras-render-preflight.mjs';
const node=(id,asset='')=>({id,type:'mesh',parent:null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],asset});
test('validates a scene with registered assets',()=>{
 const registry=createErasAssetRegistry();
 registry.register({id:'oak',type:'model',uri:'/assets/oak.glb',sha256:'f'.repeat(64),bytes:100});
 assert.deepEqual(validateErasRenderSnapshot({schemaVersion:1,nodes:[node('tree','oak')]},registry),{valid:true,nodeCount:1});
});
test('rejects unknown assets and invalid transforms',()=>{
 const registry=createErasAssetRegistry();
 assert.throws(()=>validateErasRenderSnapshot({schemaVersion:1,nodes:[node('tree','missing')]},registry));
 assert.throws(()=>validateErasRenderSnapshot({schemaVersion:1,nodes:[{...node('tree'),position:[NaN,0,0]}]},registry));
});
test('rejects cycles and missing parents',()=>{
 const registry=createErasAssetRegistry();
 assert.throws(()=>validateErasRenderSnapshot({schemaVersion:1,nodes:[{...node('tree'),parent:'missing'}]},registry));
 assert.throws(()=>validateErasRenderSnapshot({schemaVersion:1,nodes:[{...node('a'),parent:'b'},{...node('b'),parent:'a'}]},registry));
});
