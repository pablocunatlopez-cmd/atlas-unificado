import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../public/house/vendor/three.module.js';
import {createErasManifestThree} from '../../public/house/eras-manifest-three.js';
import {compileAtlasErasScene} from '../../../continuous/atlas-eras-engine-bridge.mjs';
import {buildHouse} from '../../public/house/scene.js';

const manifest=()=>compileAtlasErasScene({seed:42,player:{x:40,z:40},world:{chunkSize:24,radius:0,maxChunks:1,vegetation:20}});
function resources(group){
 const result=new Set();group.traverse(item=>{if(item.isInstancedMesh)result.add(item);if(item.geometry)result.add(item.geometry);if(item.material)result.add(item.material);});
 const counts=new Map([...result].map(item=>[item,0]));for(const item of result)item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));return counts;
}
test('compiler manifest becomes bounded instanced Three geometry with source transforms',()=>{
 const input=manifest(),before=structuredClone(input),world=createErasManifestThree(input),scene=new THREE.Scene();scene.add(world.group);
 const trees=input.chunks[0].objects.filter(o=>o.type==='tree'),rocks=input.chunks[0].objects.filter(o=>o.type==='rock');
 assert.equal(world.objectCount,20);assert.deepEqual(input,before);
 for(const [name,objects,offset] of [['eras-trees-trunks',trees,1],['eras-trees-crowns',trees,3],['eras-rocks',rocks,.45]]){
  const mesh=world.group.getObjectByName(name);assert.equal(mesh.count,objects.length);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  mesh.getMatrixAt(0,matrix);matrix.decompose(position,rotation,scale);
  assert.ok(Math.abs(position.x-objects[0].position[0])<1e-4);
  assert.ok(Math.abs(position.y-(objects[0].position[1]+offset*objects[0].scale))<1e-4);
  assert.ok(Math.abs(position.z-objects[0].position[2])<1e-4);
  assert.ok(Math.abs(rotation.y-Math.sin(objects[0].rotationY/2))<1e-5||Math.abs(rotation.y+Math.sin(objects[0].rotationY/2))<1e-5);
  assert.ok(Math.abs(scale.x-objects[0].scale)<1e-5);
 }
 const counts=resources(world.group);world.dispose();world.dispose();assert.equal(scene.children.length,0);assert.ok([...counts.values()].every(count=>count===1));
});
test('malformed or excessive manifests are rejected before creating any objects',()=>{
 const invalid=[null,{},...Array.from({length:8},()=>manifest())];
 invalid[2].chunks[0].objects[0].position[0]=NaN;
 invalid[3].chunks[0].objects[0].type='url';
 invalid[4].chunks[0].objects[0].scale=Infinity;
 invalid[5].chunks[0].objects[1].id=invalid[5].chunks[0].objects[0].id;
 invalid[6].chunks[0].key='other';
 invalid[7].chunks[0].objects[0].position[0]=0;
 invalid[8].chunks[0].objects=new Array(201).fill(invalid[8].chunks[0].objects[0]);
 invalid[9].chunks[0].objects[0].rotationY=-1;
 for(const value of invalid)assert.throws(()=>createErasManifestThree(value));
 const filtered=createErasManifestThree(manifest(),{acceptObject:()=>false});assert.equal(filtered.objectCount,0);filtered.dispose();
});
test('house opts into distant manifest only and otherwise retains the garden',()=>{
 const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
 const houses=[];
 try{
  const ordinary=buildHouse(),invalid=buildHouse({erasManifest:{}}),near=buildHouse({erasManifest:compileAtlasErasScene({world:{radius:0,vegetation:0}})}),alternative=buildHouse({erasManifest:manifest()});
  houses.push(ordinary,invalid,near,alternative);
  assert.equal(ordinary.scene.getObjectByName('eras-manifest-world'),undefined);
  assert.equal(invalid.scene.getObjectByName('eras-manifest-world'),undefined);
  assert.equal(near.scene.getObjectByName('eras-manifest-world'),undefined);
  const group=alternative.scene.getObjectByName('eras-manifest-world');assert.ok(group);
  assert.deepEqual(alternative.solids,ordinary.solids);
  assert.equal(alternative.interactive.length,ordinary.interactive.length);
  assert.equal(alternative.setErasManifest({}).accepted,false);assert.equal(alternative.scene.getObjectByName('eras-manifest-world'),group);
  const compiled=compileAtlasErasScene();const outside=compiled.chunks.flatMap(chunk=>chunk.objects).filter(({position:[x,,z]})=>Math.abs(x)<=60&&Math.abs(z)<=60&&(Math.abs(x)>=20||Math.abs(z)>=20));
  assert.ok(outside.length>0&&outside.length<compiled.chunks.reduce((n,chunk)=>n+chunk.objects.length,0));
  assert.deepEqual(ordinary.setErasManifest(compiled),{accepted:true,objects:outside.length});
  const first=ordinary.scene.getObjectByName('eras-manifest-world'),oldResources=resources(first);
  assert.equal(ordinary.setErasManifest(manifest()).accepted,true);assert.notEqual(ordinary.scene.getObjectByName('eras-manifest-world'),first);
  assert.ok([...oldResources.values()].every(count=>count===1));
  const current=ordinary.scene.getObjectByName('eras-manifest-world');
  assert.equal(ordinary.setErasManifest({}).accepted,false);assert.equal(ordinary.scene.getObjectByName('eras-manifest-world'),current);
  const counts=resources(group);alternative.dispose();assert.ok([...counts.values()].every(count=>count===1));
 }finally{for(const house of houses)house.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
