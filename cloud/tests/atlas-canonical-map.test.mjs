import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import * as THREE from '../public/house/vendor/three.module.js';
import {createAtlasSpiralLayer} from '../public/house/atlas-spiral-layer.js';
import {createAtlasHouseMode} from '../public/house/atlas-mode.js';
import {generateAtlasTangentSpirals} from '../public/house/atlas-generative-spiral.js';
test('the bounded map uses the existing scene and its vertices navigate to actual house rooms',()=>{
 const scene=new THREE.Scene(),layer=createAtlasSpiralLayer({THREE,scene});assert.equal(layer.rendererCreated,false);assert.equal(layer.mount(),true);assert.equal(layer.mount(),false);layer.show();assert.ok(layer.visible);assert.ok(layer.branchCount<=15);
 for(const [id,pos,room] of [['mental',[-8,3,-5],'mind'],['physical',[8,3,-5],'body'],['event',[0,3,9],'constellation']]){const c=new THREE.PerspectiveCamera(50,1,.1,100);c.position.set(pos[0],pos[1],pos[2]+4);c.lookAt(...pos);c.updateMatrixWorld(true);scene.updateMatrixWorld(true);assert.equal(layer.pick({raycaster:new THREE.Raycaster(),camera:c,ndc:[0,0]}),id);assert.equal(layer.roomForVertex(id),room);}
 layer.dispose();layer.dispose();assert.equal(scene.children.length,0);
});
test('map lifecycle is reversible and never allocates another renderer or loop',()=>{const calls=[],m=createAtlasHouseMode({enter:()=>calls.push('enter'),leave:()=>calls.push('leave'),renderFrame:t=>calls.push(t)});assert.equal(m.activate(),true);assert.equal(m.activate(),false);assert.equal(m.frame(16),true);assert.equal(m.deactivate(),true);assert.equal(m.frame(16),false);m.activate();m.dispose();m.dispose();assert.deepEqual(calls,['enter',16,'leave','enter','leave']);assert.equal(m.rendererCreated,false);assert.throws(()=>m.activate(),/disposed/);});
test('symbolic spiral geometry does not claim code execution or unbounded learning',()=>{const value=generateAtlasTangentSpirals();assert.equal(value.codeExecuted,false);assert.equal(value.rendererCreated,false);assert.ok(value.branches.length<=24);for(const b of value.branches)assert.ok(b.points.flat().every(Number.isFinite));const source=readFileSync(new URL('../public/house/runtime.js',import.meta.url),'utf8');assert.match(source,/atlas:house:atlas-mode'&&!prototype/);assert.match(source,/atlasLayer\.roomForVertex/);});
