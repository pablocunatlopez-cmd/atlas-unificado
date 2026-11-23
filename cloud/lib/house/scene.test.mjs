import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildHouse} from '../../public/house/scene.js';
import {HOUSE_FUNCTIONS} from '../../public/house/functional-world.js';
import {ROOMS,blocked} from '../../public/house/layout.js';

// This exercises real Three.js geometry and scene construction without a GPU.
// Canvas drawing is a minimal texture sink, not a visual/browser verification.
test('ten-room geometry builds with clear furniture spawns and finite animated instances',()=>{
 const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});
 globalThis.document={createElement(name){assert.equal(name,'canvas');return {width:0,height:0,getContext:()=>context};}};
 let house;
 try{
  house=buildHouse();for(const room of ROOMS)assert.equal(blocked(...room.spawn,.25,house.solids),false,'furniture leaves '+room.id+' spawn clear');
  assert.equal(house.interactive.filter(item=>!item.userData.functionId&&!item.userData.residentId).length,10);assert.deepEqual(new Set(house.interactive.filter(item=>item.userData.functionId).map(item=>item.userData.functionId)),new Set(HOUSE_FUNCTIONS.map(fn=>fn.id)));assert.equal(house.ceilings.children.length,10);
  house.setProcessState({at:new Date().toISOString(),processes:[{id:'library',state:'running',phase:'observe',counters:{observations:7}},{id:'review',state:'failed',phase:'refute',counters:{rejected:1}}]});
  house.update(performance.now()/1000);
  let instances=0,vertices=0,staticMeshes=0;
  house.scene.traverse(object=>{if(object.isInstancedMesh){instances+=object.count;assert.ok([...object.instanceMatrix.array].every(Number.isFinite));}else if(object.isMesh&&object.geometry?.getAttribute('position')){vertices+=object.geometry.getAttribute('position').count;staticMeshes++;}});
  assert.ok(instances>=70,'each room has real 3D body parts');assert.ok(vertices<600000,'static geometry stays within the mobile mesh budget');assert.ok(staticMeshes<100,'static materials remain batched rather than a mesh per item');
 }finally{house?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
test('disposing the house releases instance buffers and shared resources only once',()=>{
 const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
 let house;
 try{
  house=buildHouse();let instanceDisposals=0,geometryDisposals=0;const geometries=new Set();
  house.scene.traverse(item=>{if(item.isInstancedMesh)item.addEventListener('dispose',()=>instanceDisposals++);if(item.geometry)geometries.add(item.geometry);});
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++);
  house.dispose();assert.equal(instanceDisposals,3);assert.equal(geometryDisposals,geometries.size);assert.equal(house.scene.children.length,0);
  house.dispose();assert.equal(instanceDisposals,3);assert.equal(geometryDisposals,geometries.size);
 }finally{house?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
