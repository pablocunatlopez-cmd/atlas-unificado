import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../../public/house/vendor/three.module.js';
import {GLTFLoader} from '../../public/house/vendor/GLTFLoader.js';
import {cloneSkinnedTemplate,selectAdvancedResidents,createAdvancedResidents} from '../../public/house/advanced-residents.js';
import {decodeMotionLibrary,sampleMotion} from '../../public/house/motion-player.js';
const asset=new URL('../../public/house/assets/',import.meta.url);
async function bundle(sex='female'){
 const [bytes,manifest,poses]=await Promise.all([readFile(new URL('models/avatar/'+sex+'.glb',asset)),readFile(new URL('motion/manifest.json',asset),'utf8'),readFile(new URL('motion/poses.bin',asset))]);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 return{scene:gltf.scene,height:gltf.asset.extras.height,textures:Object.fromEntries(['skin','normal','roughness','hair','eyes','eyebrows','eyelashes'].map(k=>[k,new THREE.Texture()])),motion:decodeMotionLibrary(JSON.parse(manifest),poses.buffer.slice(poses.byteOffset,poses.byteOffset+poses.byteLength)),sample:sampleMotion};
}
const candidates=[{id:'language-object',archetype:'human',seated:false,position:[9.5,0,-13.25],yaw:0},{id:'language-meaning',archetype:'human',seated:false,position:[14.5,0,-13.25],yaw:0},{id:'language-symbol',archetype:'robot',seated:false,position:[12,0,-13.25],yaw:0}];
const camera={position:{x:12,y:1.64,z:-11}};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('detail selection keeps its budget, actual room, species and seating boundaries',()=>{
 assert.equal(selectAdvancedResidents(candidates,camera).length,2);assert.equal(selectAdvancedResidents(candidates,camera,{limit:1}).length,1);
 assert.deepEqual(selectAdvancedResidents(candidates,{position:{x:12,y:20,z:-11}}),[]);
 assert.deepEqual(selectAdvancedResidents(candidates.map(c=>({...c,seated:true})),camera),[]);
 assert.deepEqual(selectAdvancedResidents(candidates,{position:{x:5,y:1.64,z:3}}),[]);
 assert.equal(selectAdvancedResidents([...candidates,...candidates],camera,{limit:20}).length,2);
});

test('real ERAS anatomy clones share geometry while each avatar owns its bones and deduplicated skeletons',async()=>{
 const b=await bundle(),a=cloneSkinnedTemplate(b.scene),c=cloneSkinnedTemplate(b.scene),meshes=root=>{const out=[];root.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;};
 const original=meshes(b.scene),am=meshes(a),cm=meshes(c);assert.ok(am.length>=10);
 for(let i=0;i<am.length;i++){assert.equal(am[i].geometry,original[i].geometry);assert.notEqual(am[i].skeleton,cm[i].skeleton);assert.notEqual(am[i].skeleton.bones[0],cm[i].skeleton.bones[0]);}
 assert.equal(new Set(am.map(m=>m.skeleton)).size,1);const before=cm[0].skeleton.bones[0].quaternion.clone();am[0].skeleton.bones[0].quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),1);assert.deepEqual(cm[0].skeleton.bones[0].quaternion.toArray(),before.toArray());
 const pose=sampleMotion(b.motion,'female','Walk_Loop',.4);assert.ok(pose.quaternions.every(q=>q.toArray().every(Number.isFinite)));
});

test('lazy detail uses real authored clips, removes old actors, and releases per-actor resources on fallback',async()=>{
 const scene=new THREE.Scene(),loads=[],ready=new Map();
 const manager=createAdvancedResidents(scene,{enabled:true,loadAssets:async sex=>{loads.push(sex);const b=await bundle(sex);ready.set(sex,b);return b;}});
 manager.prepare({position:{x:0,y:20,z:0}},candidates);await flush();assert.equal(loads.length,0);
 manager.prepare(camera,candidates);while(manager.status().loading.length)await flush();manager.prepare(camera,candidates);assert.equal(manager.status().active.length,2);assert.deepEqual(new Set(loads),new Set(['male','female']));
 assert.equal(manager.update(candidates[0],{position:candidates[0].position,yaw:0,moving:true,time:.4}),true);
 assert.equal(scene.getObjectByName('advanced-language-object').userData.clip,'Walk_Loop');
 assert.equal(manager.update(candidates[1],{working:true,time:.7}),true);assert.equal(scene.getObjectByName('advanced-language-meaning').userData.clip,'Interact');
 const mesh=scene.getObjectByName('advanced-language-object').getObjectByProperty('isSkinnedMesh',true),sharedGeometry=mesh.geometry;let disposedMaterial=0,disposedGeometry=0;mesh.material.addEventListener('dispose',()=>disposedMaterial++);sharedGeometry.addEventListener('dispose',()=>disposedGeometry++);
 manager.setEnabled(false);assert.equal(scene.getObjectByName('advanced-language-object'),undefined);assert.ok(disposedMaterial>0);assert.equal(disposedGeometry,0,'switching to light mode keeps shared source geometry intact');
 manager.dispose();assert.equal(disposedGeometry,1,'template geometry disposed once on final teardown');assert.equal(scene.getObjectByName('atlas-advanced-residents'),undefined);
});

test('failed or late loads preserve the light fallback and never resurrect a disposed manager',async()=>{
 let calls=0;const parent=new THREE.Scene(),failed=createAdvancedResidents(parent,{enabled:true,loadAssets:async()=>{calls++;throw Error('offline');}});
 failed.prepare(camera,candidates.slice(0,1));await flush();failed.prepare(camera,candidates.slice(0,1));await flush();assert.equal(calls,1);assert.equal(failed.update(candidates[0],{}),false);failed.dispose();
 let complete;const late=createAdvancedResidents(parent,{enabled:true,loadAssets:()=>new Promise(resolve=>complete=resolve)});late.prepare(camera,candidates.slice(0,1));await flush();late.dispose();const b=await bundle('male');let disposed=0;b.scene.traverse(o=>{if(o.isSkinnedMesh)o.geometry.addEventListener('dispose',()=>disposed++);});complete(b);await flush();assert.ok(disposed>0);assert.equal(parent.getObjectByName('atlas-advanced-residents'),undefined);
});

test('light mode downloads nothing and reduced motion keeps a stable authored pose',async()=>{
 const parent=new THREE.Scene();let calls=0;const light=createAdvancedResidents(parent,{enabled:false,loadAssets:async()=>{calls++;return bundle();}});light.prepare(camera,candidates);await flush();assert.equal(calls,0);light.dispose();
 const still=createAdvancedResidents(parent,{enabled:true,reducedMotion:true,limit:1,loadAssets:bundle});still.prepare(camera,candidates);while(still.status().loading.length)await flush();still.prepare(camera,candidates);const id=still.status().active[0],actor=candidates.find(c=>c.id===id);still.update(actor,{moving:true,working:true,time:1});const root=parent.getObjectByName('advanced-'+id),bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});const before=bones.map(b=>b.quaternion.toArray());still.update(actor,{moving:true,working:true,time:100});assert.equal(root.userData.clip,'Idle_Loop');assert.deepEqual(bones.map(b=>b.quaternion.toArray()),before);still.dispose();
});

test('adaptive budgets obey the device ceiling and yield back to instanced fallback at zero',async()=>{
 const b=await bundle(),parent=new THREE.Group(),manager=createAdvancedResidents(parent,{enabled:true,limit:1,loadAssets:async()=>b});
 manager.prepare(camera,candidates);await flush();manager.prepare(camera,candidates);assert.equal(manager.status().active.length,1);
 manager.setBudget(0);manager.prepare(camera,candidates);assert.deepEqual(manager.status().active,[]);assert.equal(manager.status().limit,0);
 manager.setBudget(50);manager.prepare(camera,candidates);assert.equal(manager.status().limit,1);assert.equal(manager.status().active.length,1);
 manager.setEnabled(false);manager.setBudget(1);manager.prepare(camera,candidates);assert.deepEqual(manager.status().active,[]);manager.dispose();
});
