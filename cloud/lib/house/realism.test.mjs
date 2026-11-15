import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../../public/house/vendor/three.module.js';
import {createSurfaceMaps,surfaceSample,furnitureBox,projectSurfaceUV} from '../../public/house/surface-materials.js';
import {environmentPixels} from '../../public/house/environment-light.js';
import {buildHouse} from '../../public/house/scene.js';
import {houseFunction,HOUSE_FUNCTIONS} from '../../public/house/functional-world.js';
import {residentById} from '../../public/house/residents.js';
import {ROOMS,blocked,WORLD_BOUNDS} from '../../public/house/layout.js';
test('PBR textures are deterministic, tileable and keep physical data out of sRGB',()=>{
 for(const kind of ['oak','plaster','fabric','stone']){const a=createSurfaceMaps(kind,64),b=createSurfaceMaps(kind,64);assert.equal(a.map.colorSpace,THREE.SRGBColorSpace);assert.equal(a.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(a.roughnessMap.colorSpace,THREE.NoColorSpace);assert.deepEqual(a.normalMap.image.data,b.normalMap.image.data);assert.ok(new Set(a.roughnessMap.image.data).size>3);for(const [u,v]of [[.13,.28],[.74,.68]]){const s=surfaceSample(kind,u,v),t=surfaceSample(kind,u+1,v+1);assert.ok(Math.abs(s.height-t.height)<1e-8);}for(const maps of [a,b])for(const t of Object.values(maps))t.dispose();}
 const pixels=environmentPixels();assert.equal(pixels.length,256*128*4);assert.ok(pixels.every(Number.isFinite));assert.ok(pixels.some(n=>n>2),'HDR windows exceed diffuse white before PMREM');
});
test('beveled furniture preserves collision dimensions and uses world texture scale',()=>{
 const g=furnitureBox(2,.8,1);g.computeBoundingBox();const size=new THREE.Vector3();g.boundingBox.getSize(size);for(const [a,b]of [[size.x,2],[size.y,.8],[size.z,1]])assert.ok(Math.abs(a-b)<.002);assert.ok(g.attributes.position.count>24);projectSurfaceUV(g);assert.ok([...g.attributes.uv.array].every(Number.isFinite));g.dispose();
});
test('house components retain resident/code relationships; every tool has a reachable approach',()=>{
 const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};let house;
 try{house=buildHouse();assert.ok(house.components.length>400);for(const part of house.components){assert.ok(residentById(part.owner));assert.equal(part.source,'public/house/scene.js');assert.ok(part.functions.every(id=>houseFunction(id)));}
  assert.ok(house.scene.children.some(o=>o.isPointLight));let physical=false;house.scene.traverse(o=>{if(o.material?.isMeshPhysicalMaterial&&o.material.transmission>.8)physical=true;});assert.ok(physical);
  const [minX,minZ,maxX,maxZ]=WORLD_BOUNDS,scale=2,width=(maxX-minX)*scale+1,height=(maxZ-minZ)*scale+1,index=(x,z)=>Math.round((z-minZ)*scale)*width+Math.round((x-minX)*scale),start=ROOMS.find(r=>r.id==='mind').spawn,queue=[start],seen=new Set([index(...start)]);
  for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz]of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const nx=x+dx,nz=z+dz,k=index(nx,nz);if(nx<minX||nx>maxX||nz<minZ||nz>maxZ||seen.has(k)||blocked(nx,nz,.25,house.solids))continue;seen.add(k);queue.push([nx,nz]);}}
  for(const fn of HOUSE_FUNCTIONS)assert.ok(queue.some(([x,z])=>Math.hypot(x-fn.position[0],z-fn.position[2])<2.7),'Reachable approach: '+fn.id);
 }finally{house?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
