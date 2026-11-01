import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../public/house/vendor/three.module.js';
import {createProcessCreatures} from '../../public/house/process-creatures.js';

const date='2026-11-01T12:00:00.000Z';
function fixture(t){
 const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
 const scene=new THREE.Scene(),textures=[],creatures=createProcessCreatures(scene,textures,{now:()=>Date.parse(date)});
 t.after(()=>{const geometries=new Set(),materials=new Set();scene.traverse(item=>{if(item.isInstancedMesh)item.dispose();if(item.geometry)geometries.add(item.geometry);if(item.material)materials.add(item.material);});for(const item of geometries)item.dispose();for(const item of materials)item.dispose();for(const item of textures)item.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});
 return {scene,textures,creatures,bodies:scene.getObjectByName('atlas-process-bodies'),marks:scene.getObjectByName('atlas-measured-changes')};
}

test('distinct residents work only with a fresh running report and freeze all actor transforms when stale or offline',t=>{
 const {creatures,bodies}=fixture(t),state={at:date,connected:true,processes:[{id:'chat',state:'running',phase:'understand'},{id:'tools',state:'running',phase:'apply'},{id:'research',state:'running',phase:'observe'},{id:'external',state:'running',phase:'connect'}]};
 creatures.setState(state,0);creatures.update(1);const first=[...bodies.instanceMatrix.array];assert.equal(new Set(bodies.userData.archetypes).size,4);
 const identities=[...bodies.userData.archetypes];assert.ok(identities.includes('animal'),'an animal resident remains present without its own running process');
 creatures.update(2);assert.notDeepEqual([...bodies.instanceMatrix.array],first);
 creatures.update(80);const stale=[...bodies.instanceMatrix.array];creatures.update(81);assert.deepEqual([...bodies.instanceMatrix.array],stale);
 creatures.setState({...state,connected:false},82000);creatures.update(82);const offline=[...bodies.instanceMatrix.array];creatures.update(83);assert.deepEqual([...bodies.instanceMatrix.array],offline);
 creatures.setState({...state,at:undefined},0);creatures.update(1);const missing=[...bodies.instanceMatrix.array];creatures.update(2);assert.deepEqual([...bodies.instanceMatrix.array],missing);
 assert.deepEqual(bodies.userData.archetypes,identities,'telemetry changes work, not resident identities');
 creatures.setState({...state,at:'2026-11-01T12:01:40.000Z'},0);creatures.update(100);const future=[...bodies.instanceMatrix.array];creatures.update(101);assert.deepEqual([...bodies.instanceMatrix.array],future,'a future-dated packet cannot revive itself after receipt expires');
});

test('retained construction marks follow only real experience approvals, never busy frames or other accepted counters',t=>{
 const {creatures,marks}=fixture(t),state={at:date,processes:[{id:'creative',state:'running',phase:'apply',counters:{accepted:99,trials:100}}]},before=structuredClone(state);
 creatures.setState(state,0);for(let i=0;i<100;i++)creatures.update(i*.1);assert.equal(marks.visible,false);assert.equal(marks.userData.acceptedChanges,null);assert.deepEqual(state,before);
 const accepted={at:date,processes:[...state.processes,{id:'experience',state:'running',phase:'apply',counters:{accepted:1,trials:179}}]};
 creatures.setState(accepted,0);creatures.update(1);const retained=[...marks.instanceMatrix.array];assert.equal(marks.visible,true);assert.equal(marks.userData.acceptedChanges,1);
 creatures.update(50);assert.deepEqual([...marks.instanceMatrix.array],retained);assert.equal(marks.userData.acceptedChanges,1);assert.equal(accepted.processes[1].counters.accepted,1);
});

test('actor geometry remains instanced and bounded for mobile rendering',t=>{
 const {creatures,scene,textures}=fixture(t);creatures.setState({at:date,processes:[]},0);creatures.update(1);
 const instances=scene.children.filter(item=>item.isInstancedMesh);
 assert.equal(instances.length,3);assert.equal(instances.reduce((sum,item)=>sum+item.count,0),103);assert.equal(new Set(instances.map(item=>item.geometry)).size,2);assert.equal(textures.length,10);
 for(const item of instances)assert.ok([...item.instanceMatrix.array].every(Number.isFinite));
});

test('mobile resident labels cap projected width at 220px near the camera and retain base scale in the overview',t=>{
 const {creatures,scene}=fixture(t),sprite=scene.getObjectByName('atlas-resident-label-lab'),height=844,width=390,camera=new THREE.PerspectiveCamera(67,width/height,.08,190);
 const projectedWidth=()=>{const left=new THREE.Vector3(sprite.position.x-sprite.scale.x/2,sprite.position.y,sprite.position.z).project(camera),right=new THREE.Vector3(sprite.position.x+sprite.scale.x/2,sprite.position.y,sprite.position.z).project(camera);return Math.abs(right.x-left.x)*width/2;};
 for(const depth of [.5,1,2]){
  camera.position.copy(sprite.position).add(new THREE.Vector3(0,0,depth));camera.lookAt(sprite.position);creatures.update(1,camera,height);
  assert.equal(sprite.visible,true);assert.ok(projectedWidth()<=220.001);assert.ok(projectedWidth()>219);assert.ok(Math.abs(sprite.scale.x/sprite.scale.y-2.8/.66)<1e-9);
 }
 camera.position.copy(sprite.position).add(new THREE.Vector3(0,0,40));camera.lookAt(sprite.position);creatures.update(2,camera,height);assert.equal(sprite.scale.x,2.8);assert.equal(sprite.scale.y,.66);assert.ok(projectedWidth()<220);
 camera.position.copy(sprite.position).add(new THREE.Vector3(0,0,-1));camera.lookAt(sprite.position.clone().add(new THREE.Vector3(0,0,-2)));creatures.update(3,camera,height);assert.equal(sprite.visible,false);
});
