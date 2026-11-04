import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../public/house/vendor/three.module.js';
import {createProcessCreatures,processForResident} from '../../public/house/process-creatures.js';
import {RESIDENTS,WORKSTATIONS,AUDIENCE,residentById} from '../../public/house/residents.js';
import {normalizeProcessState} from '../../public/house/process-state.js';

const date='2026-11-01T12:00:00.000Z';
function fixture(t){
 const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
 const scene=new THREE.Scene(),textures=[],creatures=createProcessCreatures(scene,textures,{now:()=>Date.parse(date)});
 t.after(()=>{const geometries=new Set(),materials=new Set();scene.traverse(item=>{if(item.isInstancedMesh)item.dispose();if(item.geometry)geometries.add(item.geometry);if(item.material)materials.add(item.material);});for(const item of geometries)item.dispose();for(const item of materials)item.dispose();for(const item of textures)item.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});
 return {scene,textures,creatures,bodies:scene.getObjectByName('atlas-process-bodies'),heads:scene.getObjectByName('atlas-process-heads'),marks:scene.getObjectByName('atlas-measured-changes')};
}
const position=(mesh,index)=>{const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix);};

test('residents use explicitly assigned process IDs; sharing a room never authorizes work and audiences remain quiet',()=>{
 const state=normalizeProcessState({at:date,processes:[{id:'chat',state:'running',phase:'understand'},{id:'tools',state:'running',phase:'apply'},{id:'video',state:'running',phase:'apply'},{id:'music',state:'running',phase:'apply'},{id:'experience',state:'running',phase:'understand'}]});
 assert.equal(processForResident(state,residentById('salon-centre'),{ageMs:1}).workVerified,true);
 assert.equal(processForResident(state,residentById('body-console'),{ageMs:1}).workVerified,true);
 assert.equal(processForResident(state,residentById('mind-desk'),{ageMs:1}).workVerified,true);
 assert.equal(processForResident(state,residentById('lab-bench'),{ageMs:1}).workVerified,false,'another phase of the same experience is not laboratory activity');
 assert.equal(processForResident(state,residentById('music-console'),{ageMs:1}).workVerified,false);
 assert.match(processForResident(state,residentById('music-console'),{ageMs:1}).displayState,/local/);
 for(const resident of AUDIENCE)assert.equal(processForResident(state,resident,{ageMs:1}).workVerified,false);
 assert.equal(processForResident(state,residentById('cinema-projector'),{ageMs:1}).workVerified,true);
 for(const ageMs of [-1,Infinity,76000])assert.equal(processForResident(state,residentById('body-console'),{ageMs}).workVerified,false);
});

test('every resident remains present and keeps identity while only fresh relevant work can change the actor poses',t=>{
 const {creatures,bodies,heads}=fixture(t),state={at:date,connected:true,processes:[{id:'chat',state:'running',phase:'understand'},{id:'tools',state:'running',phase:'apply'},{id:'research',state:'running',phase:'observe'},{id:'agents',state:'running',phase:'connect'}]};
 creatures.setState(state,0);creatures.update(1);const first=[...bodies.instanceMatrix.array],identities=[...bodies.userData.archetypes];
 assert.equal(identities.length,24);assert.equal(new Set(identities).size,4);assert.equal(bodies.userData.work.length,24);
 assert.ok(bodies.userData.work.some(item=>item.workVerified));assert.ok(AUDIENCE.every(resident=>!bodies.userData.work.find(item=>item.id===resident.id).workVerified));
 creatures.update(2);assert.notDeepEqual([...bodies.instanceMatrix.array],first);
 creatures.update(80);const stale=[...bodies.instanceMatrix.array],staleHeads=[...heads.instanceMatrix.array];creatures.update(81);assert.deepEqual([...bodies.instanceMatrix.array],stale);assert.deepEqual([...heads.instanceMatrix.array],staleHeads);
 creatures.setState({...state,connected:false},82000);creatures.update(82);const offline=[...bodies.instanceMatrix.array];creatures.update(83);assert.deepEqual([...bodies.instanceMatrix.array],offline);
 creatures.setState({...state,at:undefined},0);creatures.update(1);const missing=[...bodies.instanceMatrix.array];creatures.update(2);assert.deepEqual([...bodies.instanceMatrix.array],missing);
 creatures.setState({...state,at:'2026-11-01T12:01:40.000Z'},0);creatures.update(100);const future=[...bodies.instanceMatrix.array];creatures.update(101);assert.deepEqual([...bodies.instanceMatrix.array],future);
 assert.deepEqual(bodies.userData.archetypes,identities);assert.equal(bodies.userData.roster,RESIDENTS);
});

test('actors occupy real seats and face the furniture rather than a shared global direction',t=>{
 const {creatures,bodies,heads}=fixture(t);creatures.update(1);
 const resident=residentById('music-console'),index=RESIDENTS.indexOf(resident),head=position(heads,index*6),eyes=position(heads,index*6+3).add(position(heads,index*6+4)).multiplyScalar(.5);
 assert.ok(Math.abs(head.x-resident.position[0])<1e-5);assert.ok(Math.abs(head.z-resident.position[2])<1e-5);assert.ok(head.y>1.3&&head.y<1.5);
 const forward=new THREE.Vector3(Math.sin(resident.yaw),0,-Math.cos(resident.yaw)),face=eyes.sub(head);assert.ok(face.dot(forward)>.15,'the face points west towards the music desk');
 const hip=position(bodies,index*18+1),foot=position(bodies,index*18+6);assert.ok(hip.y>.48&&hip.y<.75);assert.ok(foot.clone().sub(new THREE.Vector3(...resident.position)).dot(forward)>.3,'bent seated legs point towards the desk');
 const standing=position(heads,RESIDENTS.indexOf(residentById('salon-centre'))*6);assert.ok(standing.y>head.y);
});

test('retained construction marks use only the actual experience approval counter',t=>{
 const {creatures,marks}=fixture(t),state={at:date,processes:[{id:'creative',state:'running',phase:'apply',counters:{accepted:99,trials:100}}]},before=structuredClone(state);
 creatures.setState(state,0);for(let i=0;i<100;i++)creatures.update(i*.1);assert.equal(marks.visible,false);assert.equal(marks.userData.acceptedChanges,null);assert.deepEqual(state,before);
 const accepted={at:date,processes:[...state.processes,{id:'experience',state:'running',phase:'apply',counters:{accepted:1,trials:179}}]};
 creatures.setState(accepted,0);creatures.update(1);const retained=[...marks.instanceMatrix.array];assert.equal(marks.visible,true);assert.equal(marks.userData.acceptedChanges,1);
 creatures.update(50);assert.deepEqual([...marks.instanceMatrix.array],retained);assert.equal(accepted.processes[1].counters.accepted,1);
});

test('24 detailed actors remain bounded to three instanced draws with no downloaded assets or per-actor meshes',t=>{
 const {creatures,scene,textures,bodies}=fixture(t);creatures.update(1);const instances=[];scene.traverse(item=>{if(item.isInstancedMesh)instances.push(item);});
 assert.equal(instances.length,3);assert.equal(instances.reduce((sum,item)=>sum+item.count,0),579);assert.equal(new Set(instances.map(item=>item.geometry)).size,2);assert.equal(textures.length,WORKSTATIONS.length);
 assert.equal(scene.getObjectByName('atlas-residents').userData.roster.length,24);assert.equal(bodies.castShadow,true);
 for(const item of instances)assert.ok([...item.instanceMatrix.array].every(Number.isFinite));
 for(let actor=0;actor<RESIDENTS.length;actor++){let visible=0;for(let part=0;part<18;part++)if(position(bodies,actor*18+part).y>-10)visible++;assert.ok(visible>=10,'each archetype has a visible articulated body');}
});

test('operator labels stay above the head, cap at 160 CSS pixels and disappear in overview and other rooms',t=>{
 const {creatures,scene}=fixture(t),sprite=scene.getObjectByName('atlas-resident-label-lab-bench'),height=844,width=390,camera=new THREE.PerspectiveCamera(67,width/height,.08,190);
 const projectedWidth=()=>{const left=new THREE.Vector3(sprite.position.x-sprite.scale.x/2,sprite.position.y,sprite.position.z).project(camera),right=new THREE.Vector3(sprite.position.x+sprite.scale.x/2,sprite.position.y,sprite.position.z).project(camera);return Math.abs(right.x-left.x)*width/2;};
 for(const depth of [.5,1,2]){camera.position.copy(sprite.position).add(new THREE.Vector3(0,0,depth));camera.lookAt(sprite.position);creatures.update(1,camera,height);assert.equal(sprite.visible,true);assert.ok(projectedWidth()<=160.001);assert.ok(projectedWidth()>159);}
 camera.position.set(0,25,30);camera.lookAt(0,0,-3);creatures.update(2,camera,height);assert.ok(scene.getObjectByName('atlas-residents').children.filter(item=>item.isSprite).every(label=>!label.visible));
 camera.position.set(7,1.64,4);camera.lookAt(sprite.position);creatures.update(3,camera,height);assert.equal(sprite.visible,false);
 assert.ok(sprite.position.y-.25>1.44,'the full-size lab label clears the fox ears');assert.equal(scene.getObjectByName('atlas-resident-label-cinema-audience-1'),undefined);
});
