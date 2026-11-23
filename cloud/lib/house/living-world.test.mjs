import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../public/house/vendor/three.module.js';
import {ROOMS,blocked,roomAt} from '../../public/house/layout.js';
import {RESIDENTS} from '../../public/house/residents.js';
import {validateLivingProposal,validateLivingState,livingPattern} from '../../public/house/living-contract.js';
import {createLivingInstallation} from '../../public/house/living-installation.js';
import {createLivingPresentations} from '../../public/house/living-presentation.js';
import {buildHouse} from '../../public/house/scene.js';
import {validatePattern,TRACK_IDS} from '../music/pattern.mjs';

const proposal=()=>({title:'Jardín de órbitas',goal:'Un móvil celeste con una paleta fría y acentos cálidos.',colors:['#163b54','#67e8da','#f3be69'],objects:[{shape:'sphere',x:-1,y:0,z:0,size:.65,color:0},{shape:'torus',x:1,y:1,z:0,size:.65,color:1}],program:[{op:'rotate',target:0,speed:.5,amount:0},{op:'float',target:1,speed:.8,amount:.1},{op:'pulse',target:1,speed:.7,amount:.1}],music:{bpm:112,swing:.12,kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],bass:[0,4,8,12],notes:Array.from({length:16},(_,i)=>[36,43,39,46][i%4])},film:{rooms:['music','games'],seconds:8},walk:true});
const artifact=(room='games',id='a',p=proposal())=>({id:'living-'+id.repeat(24),room,actorId:'resident:games-desk',actorName:'Talo',at:'2026-11-11T10:00:00.000Z',proposal:p});
function canvas(t){const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};t.after(()=>{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});}

test('scene contract removes external instructions and rejects invalid geometry, programs, music and camera rooms',()=>{
 const raw=proposal();raw.script='fetch("https://example.invalid")';raw.objects[0].script='run';const checked=validateLivingProposal(raw);
 assert.equal('script' in checked,false);assert.equal('script' in checked.objects[0],false);
 for(const mutate of [p=>p.objects[0].size=1,p=>p.objects[0].x=NaN,p=>p.program[0].op='eval',p=>p.program[0].target=99,p=>p.program[0].amount=.11,p=>p.music.notes.pop(),p=>p.music.kick=[],p=>p.music.bass=[0,0],p=>p.film.rooms=['unknown'],p=>p.colors[0]='url(https://example.invalid)']){const p=proposal();mutate(p);assert.throws(()=>validateLivingProposal(p));}
 assert.deepEqual(validateLivingState({artifacts:{games:artifact('games'),unknown:artifact('unknown'),music:{...artifact('music'),id:'bad'}}}).artifacts,{games:{...artifact('games'),proposal:checked}});
});

test('authored score compiles to the real music-studio format, including active notes and sound levels',()=>{
 const p=proposal(),pattern=validatePattern(livingPattern(p));assert.equal(pattern.bpm,112);assert.equal(pattern.swing,.12);assert.equal(pattern.master,.55);
 for(const track of TRACK_IDS)assert.deepEqual(pattern.tracks[track].steps,p.music[track].length?Array.from({length:16},(_,i)=>p.music[track].includes(i)):Array(16).fill(false));
 assert.deepEqual(pattern.bassNotes,p.music.notes);assert.equal(pattern.tracks.bass.mute,false);assert.ok(pattern.tracks.bass.volume>0);
 pattern.bassNotes[0]=72;assert.equal(p.music.notes[0],36,'compiled score owns its notes');
});

test('real Three.js installation changes geometry and motion, idempotently swaps versions and disposes its resources',t=>{
 canvas(t);const scene=new THREE.Scene(),installation=createLivingInstallation(scene),state={artifacts:{games:artifact()}};t.after(()=>installation.dispose());
 installation.setState(state);assert.deepEqual(installation.status(),{rooms:1,objects:2});const root=scene.getObjectByName('atlas-living-world'),group=root.children[0],sphere=group.getObjectByName('living-object-0'),torus=group.getObjectByName('living-object-1');
 assert.equal(sphere.geometry.type,'SphereGeometry');assert.equal(torus.geometry.type,'TorusGeometry');assert.equal(group.getObjectByName('living-floor').position.y,.052,'overlay must be above house floor surface y=.04');
 installation.setState(state);assert.equal(root.children[0],group,'unchanged receipt does not allocate geometry again');
 installation.update(0);const y=torus.position.y,scale=torus.scale.x;installation.update(1);assert.equal(sphere.rotation.y,.5);assert.notEqual(torus.position.y,y);assert.notEqual(torus.scale.x,scale);
 const resources=new Set();group.traverse(o=>{if(o.geometry&&!o.isSprite)resources.add(o.geometry);if(o.material){resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});let disposed=0;for(const item of resources)item.addEventListener('dispose',()=>disposed++);
 installation.setState({artifacts:{games:artifact('games','b')}});assert.equal(disposed,resources.size);assert.equal(root.children.length,1);assert.notEqual(root.children[0],group);
 installation.setState({artifacts:{games:{...artifact(),proposal:{bad:true}}}});assert.equal(root.children.length,1,'bad incoming state preserves valid displayed work');
 installation.dispose();assert.equal(scene.children.length,0);installation.dispose();assert.equal(disposed,resources.size,'repeat disposal does not dispose old resources again');
});

test('all ten authored rooms stay below ceiling, above walking space and within their own room',t=>{
 canvas(t);const scene=new THREE.Scene(),installation=createLivingInstallation(scene),p=proposal();p.objects=[...p.objects,{shape:'box',x:1.5,y:0,z:1.5,size:.65,color:2},{shape:'cylinder',x:-1.5,y:1,z:-1.5,size:.65,color:0}];installation.setState({artifacts:Object.fromEntries(ROOMS.map(room=>[room.id,artifact(room.id,'a',p)]))});t.after(()=>installation.dispose());assert.deepEqual(installation.status(),{rooms:10,objects:40});
 for(const time of [0,1,2,10,100,1e6]){installation.update(time);scene.updateMatrixWorld(true);for(const room of ROOMS){const group=scene.getObjectByName('living-'+room.id);for(const o of group.children.filter(o=>o.name.startsWith('living-object-'))){const box=new THREE.Box3().setFromObject(o);assert.ok(box.min.y>1.8&&box.max.y<3.1,`${room.id}/${o.name} stays in display volume`);assert.ok(box.min.x>room.bounds[0]&&box.max.x<room.bounds[2]&&box.min.z>room.bounds[1]&&box.max.z<room.bounds[3]);}}}
});

test('room palette changes real architectural framing with two low-budget meshes and no lights',t=>{
 canvas(t);const scene=new THREE.Scene(),installation=createLivingInstallation(scene),p=proposal();installation.setState({artifacts:{music:artifact('music','a',p)}});t.after(()=>installation.dispose());
 const group=scene.getObjectByName('living-music'),frames=group.children.filter(o=>o.userData.architecture);assert.equal(frames.length,2);assert.ok(frames.every(o=>o.isMesh&&!o.castShadow));assert.equal(frames.reduce((n,o)=>n+o.geometry.getAttribute('position').count,0),192);
 const floor=group.getObjectByName('living-floor-frame'),cornice=group.getObjectByName('living-cornice');assert.equal(floor.material.color.getHexString(),p.colors[1].slice(1));assert.equal(cornice.material.color.getHexString(),p.colors[2].slice(1));scene.updateMatrixWorld(true);
 const floorBounds=new THREE.Box3().setFromObject(floor),ceilingBounds=new THREE.Box3().setFromObject(cornice);assert.ok(floorBounds.min.y>.052&&floorBounds.max.y<.08);assert.ok(ceilingBounds.min.y>2.9&&ceilingBounds.max.y<3.1);let lights=0;scene.traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0);
 const next=proposal();next.colors=['#102040','#ffaa33','#99eeff'];installation.setState({artifacts:{music:artifact('music','b',next)}});assert.equal(scene.getObjectByName('living-floor-frame').material.color.getHexString(),'ffaa33');assert.equal(scene.getObjectByName('living-cornice').material.color.getHexString(),'99eeff');
});

test('presentations move on real furniture-aware routes and remain separate from work telemetry',t=>{
 canvas(t);const house=buildHouse();t.after(()=>house.dispose());const presentation=createLivingPresentations({walls:house.solids}),state={artifacts:Object.fromEntries(ROOMS.map(room=>[room.id,artifact(room.id)]))};presentation.setState(state);let movement=0;
 for(const resident of RESIDENTS){for(let time=0;time<45;time+=.5){const sample=presentation.sample(resident.id,time);if(resident.cosmetic){assert.equal(sample,null);continue;}assert.ok(sample);assert.equal('workVerified' in sample,false);assert.equal('accepted' in sample,false);if(sample.position){assert.equal(blocked(sample.position[0],sample.position[2],.22,house.solids),false,resident.id+' route avoids furniture and walls');assert.equal(roomAt(sample.position[0],sample.position[2]),resident.room);if(sample.moving)movement++;}}}
 assert.ok(movement>20,'real resident routes exist rather than only still captions');
});

test('new walk:false work disables old presentations and clears focus positions; reduced motion disables travel',()=>{
 const presentations=createLivingPresentations(),state={artifacts:{games:artifact()}};presentations.setState(state);assert.ok(presentations.sample('games-desk',1));const p=proposal();p.walk=false;presentations.setState({artifacts:{games:artifact('games','b',p)}});assert.equal(presentations.sample('games-desk',2),null);assert.equal(presentations.positionForResident('games-desk'),null);
 const reduced=createLivingPresentations({reducedMotion:true});reduced.setState(state);assert.equal(reduced.sample('games-desk',1),null);
});

test('house integration presents saved work without inventing activity, and targeted cloud work activates only its resident',t=>{
 canvas(t);const house=buildHouse();t.after(()=>house.dispose());house.setLivingState({artifacts:{music:artifact('music')}});house.update(performance.now()/1000);
 const bodies=house.scene.getObjectByName('atlas-process-bodies');assert.ok(bodies.userData.work.some(w=>w.presentation));assert.ok(bodies.userData.work.every(w=>!w.workVerified));
 house.setProcessState({connected:true,at:new Date().toISOString(),processes:[{id:'creative',actorId:'music-console',room:'music',phase:'apply',state:'running'}]});house.update(performance.now()/1000);
 assert.deepEqual(bodies.userData.work.filter(w=>w.workVerified).map(w=>w.id),['music-console']);assert.equal(bodies.userData.work.find(w=>w.id==='music-console').presentation,null,'actual work takes priority over a scripted presentation');
 assert.equal(house.scene.getObjectByName('atlas-measured-changes').visible,false,'creation presentation does not invent a measured approval');
});
