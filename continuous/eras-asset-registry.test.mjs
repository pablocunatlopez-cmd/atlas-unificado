import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasAssetRegistry} from './eras-asset-registry.mjs';
const asset={id:'oak',type:'model',uri:'/assets/forest/oak.glb',sha256:'a'.repeat(64),bytes:12000};
test('registers trusted assets and validates scene references',()=>{
 const registry=createErasAssetRegistry();
 registry.register(asset);
 assert.deepEqual(registry.resolve('oak'),asset);
 assert.deepEqual(registry.validateReferences([{id:'tree',asset:'oak'},{id:'empty',asset:''}]),{valid:true,missing:[]});
 assert.deepEqual(registry.validateReferences([{id:'tree',asset:'missing'}]),{valid:false,missing:[{nodeId:'tree',assetId:'missing'}]});
});
test('rejects remote URLs, traversal, duplicates and missing integrity metadata',()=>{
 const registry=createErasAssetRegistry();
 for(const uri of ['https://example.com/a.glb','/assets/../secret','javascript:alert(1)']){
   assert.throws(()=>registry.register({...asset,uri}));
 }
 assert.throws(()=>registry.register({...asset,sha256:'not-a-hash'}));
 registry.register(asset);
 assert.throws(()=>registry.register(asset));
});
test('enforces asset budget',()=>{
 const registry=createErasAssetRegistry({maxAssets:1});
 registry.register(asset);
 assert.throws(()=>registry.register({...asset,id:'pine'}));
});
