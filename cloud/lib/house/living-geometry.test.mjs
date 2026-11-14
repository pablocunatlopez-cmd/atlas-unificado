import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../public/house/vendor/three.module.js';
import {createLivingGeometry,LIVING_SHAPES} from '../../public/house/living-geometry.js';
import {createLivingInstallation} from '../../public/house/living-installation.js';
import {ROOMS} from '../../public/house/layout.js';
const proposal=(environment={style:'gallery',floor:'grid',intensity:.45})=>({title:'Jardín de geometrías',goal:'Formas y arquitectura que responden a una activación local.',colors:['#163b54','#67e8da','#f3be69'],objects:[{shape:'arch',x:-1,y:0,z:0,size:.65,color:0},{shape:'helix',x:0,y:1,z:0,size:.65,color:1},{shape:'bloom',x:1,y:.5,z:0,size:.65,color:2}],program:[{op:'rotate',target:1,speed:.5,amount:0},{op:'float',target:0,speed:.5,amount:.1}],music:{bpm:112,swing:.12,kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],bass:[0,4,8,12],notes:Array.from({length:16},(_,i)=>[36,43,39,46][i%4])},film:{rooms:['music'],seconds:8},walk:true,environment});
const state=(p=proposal(),id='a')=>({artifacts:{music:{id:'living-'+id.repeat(24),room:'music',actorId:'resident:music-console',actorName:'Noa',at:'2026-11-11T19:00:00.000Z',proposal:p}}});
function canvas(t){const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};t.after(()=>{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});}

test('nine real procedural shapes stay finite inside a unit box and a bounded vertex budget',()=>{
 assert.equal(LIVING_SHAPES.length,9);const signatures=new Set();
 for(const shape of LIVING_SHAPES){const geometry=createLivingGeometry(shape);geometry.computeBoundingBox();const bounds=geometry.boundingBox,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');assert.ok(positions.count<=1800,shape+' vertex budget');assert.ok([...positions.array,...normals.array].every(Number.isFinite));for(const axis of ['x','y','z']){assert.ok(bounds.min[axis]>=-.500001,shape+'/'+axis+' lower bound');assert.ok(bounds.max[axis]<=.500001,shape+'/'+axis+' upper bound');}assert.ok(geometry.boundingBox.getSize(new THREE.Vector3()).length()>.2,shape+' is not empty');signatures.add(positions.count+':'+bounds.min.toArray().join(','));geometry.dispose();}
 assert.equal(signatures.size,9,'each primitive has distinct actual geometry');assert.throws(()=>createLivingGeometry('script'));
});

test('all architectural styles and floor patterns build distinct geometry below the ceiling with no new lights',t=>{
 canvas(t);const scene=new THREE.Scene(),installation=createLivingInstallation(scene);t.after(()=>installation.dispose());const signatures=[];
 for(const [i,style] of ['gallery','observatory','garden','arcade'].entries()){
  const p=proposal({style,floor:['grid','rings','tiles','grid'][i],intensity:.6});installation.setState(state(p,String.fromCharCode(97+i)));scene.updateMatrixWorld(true);const room=scene.getObjectByName('living-music'),kit=room.getObjectByName('living-environment-kit'),pattern=room.getObjectByName('living-floor-pattern'),bounds=new THREE.Box3().setFromObject(kit),r=ROOMS.find(r=>r.id==='music');
  assert.equal(kit.userData.style,style);assert.equal(pattern.userData.floor,p.environment.floor);assert.ok(kit.geometry.getAttribute('position').count<7000);assert.ok(bounds.min.y>2.8&&bounds.max.y<3.05);assert.ok(bounds.min.x>r.bounds[0]&&bounds.max.x<r.bounds[2]&&bounds.min.z>r.bounds[1]&&bounds.max.z<r.bounds[3]);assert.equal(pattern.position.y,.056);assert.ok(pattern.geometry.getAttribute('position').count<350);assert.equal(kit.castShadow,false);assert.equal('workVerified' in kit.userData,false);let lights=0;scene.traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0);signatures.push(kit.geometry.getAttribute('position').count);
 }
 assert.equal(new Set(signatures).size,4,'style changes create different geometry, not only a label');
});

test('activation produces a temporary real response without changing geometric extents or learning counters',t=>{
 canvas(t);const scene=new THREE.Scene(),installation=createLivingInstallation(scene);t.after(()=>installation.dispose());installation.setState(state());installation.update(10);const object=scene.getObjectByName('living-object-2'),position=object.position.clone(),scale=object.scale.clone();assert.equal(object.rotation.y,0);assert.deepEqual(installation.activate('unknown'),{activated:false});
 const receipt=installation.activate('music');assert.equal(receipt.activated,true);assert.equal(receipt.artifactId,'living-'+'a'.repeat(24));assert.equal(receipt.at,10);installation.update(11);assert.ok(object.rotation.y>0);assert.ok(object.material.emissiveIntensity>.15);assert.deepEqual(object.position,position);assert.deepEqual(object.scale,scale);assert.deepEqual(installation.interactionStatus(),{count:1,last:{room:'music',artifactId:'living-'+'a'.repeat(24),at:10},activeRooms:['music']});assert.deepEqual(installation.status(),{rooms:1,objects:3});
 installation.update(12.1);assert.equal(object.rotation.y,0);assert.equal(object.material.emissiveIntensity,.15);assert.deepEqual(installation.interactionStatus().activeRooms,[]);assert.equal('learning' in installation.interactionStatus(),false);
});

test('replacing rich-room versions releases all owned geometries and materials once',t=>{
 canvas(t);const scene=new THREE.Scene(),installation=createLivingInstallation(scene);t.after(()=>installation.dispose());installation.setState(state(proposal({style:'garden',floor:'rings',intensity:.7})));const first=scene.getObjectByName('living-music'),resources=new Set();first.traverse(o=>{if(o.geometry&&!o.isSprite)resources.add(o.geometry);if(o.material){resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});let releases=0;for(const resource of resources)resource.addEventListener('dispose',()=>releases++);
 installation.setState(state(proposal({style:'arcade',floor:'tiles',intensity:.3}),'b'));assert.equal(releases,resources.size);assert.notEqual(scene.getObjectByName('living-music'),first);installation.dispose();assert.equal(releases,resources.size);assert.deepEqual(installation.activate('music'),{activated:false});
});
