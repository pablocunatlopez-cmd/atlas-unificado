import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Scene,ShaderLib,Vector3} from '../../public/house/vendor/three.module.js';
import {createCreatureModels} from '../../public/house/creature-models.js';
import {RESIDENTS,residentById} from '../../public/house/residents.js';
import {HOUSE_FUNCTIONS} from '../../public/house/functional-world.js';

test('every nonhuman has an articulated mesh with its canonical role and connected functions',t=>{
 const scene=new Scene(),models=createCreatureModels(scene);
 t.after(()=>models.dispose());
 let triangles=0;
 for(const resident of RESIDENTS){
  const shouldHaveMesh=resident.archetype!=='human';
  assert.equal(models.update(resident),shouldHaveMesh,resident.id);
  const actor=scene.getObjectByName('atlas-sculpt-'+resident.id);
  if(!shouldHaveMesh){assert.equal(actor,undefined);continue;}
  const mesh=actor.children[0],geometry=mesh.geometry;
  assert.equal(actor.children.length,1);
  assert.equal(actor.userData.residentId,resident.id);
  assert.equal(actor.userData.role,resident.role);
  assert.deepEqual(actor.userData.functions,HOUSE_FUNCTIONS.filter(fn=>fn.owner===resident.id).map(fn=>fn.id));
  assert.deepEqual(actor.position.toArray(),resident.position);
  assert.ok(mesh.isSkinnedMesh);
  assert.ok(mesh.skeleton.bones.length>5);
  assert.ok(geometry.attributes.position.count>1500);
  assert.equal(geometry.attributes.position.count,geometry.attributes.surfaceResponse.count);
  const bounds=geometry.boundingBox;
  assert.ok(bounds.getSize(new Vector3()).length()<2);
  assert.ok(Array.from(geometry.attributes.normal.array).every(Number.isFinite));
  triangles+=geometry.index.count/3;
 }
 const root=scene.getObjectByName('atlas-creature-models');
 assert.equal(root.children.length,14);
 assert.ok(triangles<180000);
});

test('poses use the reported motion and preserve identity, rest and live work through a room change',t=>{
 const scene=new Scene(),models=createCreatureModels(scene),sigma=residentById('language-symbol');
 t.after(()=>models.dispose());
 models.update(sigma);
 const actor=scene.getObjectByName('atlas-sculpt-language-symbol');
 const mesh=actor.children[0],arm=mesh.skeleton.getBoneByName('armRight');
 const rest=arm.rotation.x;
 const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}};
 mesh.material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.creatureWorking.value,0);
 assert.match(shader.fragmentShader,/metalnessFactor = vCreatureSurface.y/);
 const travel=[-4.8,0,-9.5];
 models.update(sigma,{position:travel,yaw:Math.PI/2,motion:{rightArm:.45},working:true});
 assert.deepEqual(actor.position.toArray(),travel);
 assert.equal(actor.rotation.y,Math.PI/2);
 assert.notEqual(arm.rotation.x,rest);
 assert.equal(shader.uniforms.creatureWorking.value,1);
 assert.equal(actor.userData.currentWork,true);
 models.update(sigma,{position:travel,motion:{rightArm:.45},working:true,reducedMotion:true});
 assert.equal(arm.rotation.x,rest);
 assert.equal(actor.userData.currentWork,true);
 models.update(sigma,{position:travel});
 assert.equal(shader.uniforms.creatureWorking.value,0);
 assert.equal(models.update({...sigma,id:'unknown'}),false);
 assert.equal(models.update(sigma,{position:[NaN,0,0]}),false);
});

test('animal and bird poses align with the station and dispose their render resources once',()=>{
 const scene=new Scene(),models=createCreatureModels(scene);
 models.update(residentById('lab-bench'));
 models.update(residentById('sky-agents'));
 const animal=scene.getObjectByName('atlas-sculpt-lab-bench');
 const bird=scene.getObjectByName('atlas-sculpt-sky-agents');
 scene.updateMatrixWorld(true);
 assert.ok(Math.abs(new Box3().setFromObject(animal,true).min.y)<.04);
 assert.ok(new Box3().setFromObject(bird,true).min.y>.40);
 const mesh=bird.children[0],wing=mesh.skeleton.getBoneByName('wingRight');
 assert.equal(wing.rotation.z,0);
 models.update(residentById('sky-agents'),{motion:{wing:.5},working:true});
 assert.ok(wing.rotation.z>.3);
 let freed=0;
 for(const actor of [animal,bird]){
  const [m]=actor.children;
  m.geometry.addEventListener('dispose',()=>freed++);
  m.material.addEventListener('dispose',()=>freed++);
 }
 models.dispose();
 models.dispose();
 assert.equal(freed,4);
 assert.equal(scene.children.length,0);
 assert.equal(models.update(residentById('sky-agents')),false);
});
