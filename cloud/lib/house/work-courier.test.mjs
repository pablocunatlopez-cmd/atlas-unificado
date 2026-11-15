import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHouseWork,planWorkDelivery,createWorkCourier} from '../../public/house/work-courier.js';
import {residentById,processForResident} from '../../public/house/residents.js';
import {buildHouse} from '../../public/house/scene.js';
import {movePlayer,blocked} from '../../public/house/layout.js';
import * as THREE from '../../public/house/vendor/three.module.js';
import {createProcessCreatures} from '../../public/house/process-creatures.js';
const epoch=Date.parse('2026-11-14T12:00:00Z'),at=new Date(epoch).toISOString();
const event=(patch={})=>({id:'work-00000000-0000-4000-8000-000000000001',workerId:'lab-desk',messengerId:'language-symbol',recipientIds:['music-console','salon-centre'],status:'tested',at,startedAt:at,sourceCount:2,artifactCount:0,modelSteps:2,operation:'research',...patch});
const snapshot=(...events)=>({schema:1,events});
const meta={connected:true,sourceAgeMs:0,receivedAtMs:0};
function geometry(t){const old=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};const house=buildHouse();t.after(()=>{house.dispose();if(old===undefined)delete globalThis.document;else globalThis.document=old;});return house;}

test('work events have closed identities, counts, recipients and data projection',()=>{
 const clean=normalizeHouseWork(snapshot({...event(),code:'secret',url:'private',question:'private'}));assert.equal(clean.events.length,1);assert.doesNotMatch(JSON.stringify(clean),/secret|private|question/);
 for(const patch of [{id:'invented'},{messengerId:'missing'},{workerId:'missing'},{recipientIds:['missing']},{recipientIds:['music-console','salon-centre','body-console']},{modelSteps:3},{sourceCount:3},{artifactCount:5},{operation:'eval-code'},{status:'running'},{at:'bad-date'}])assert.equal(normalizeHouseWork(snapshot(event(patch))).events.length,0);
 assert.equal(normalizeHouseWork({schema:2,events:[]}),null);
});
test('Siggy travels through the furnished doors to the sky, both recipients and home',t=>{
 const house=geometry(t),legs=planWorkDelivery(event(),{walls:house.solids});assert.equal(legs.length,4);assert.deepEqual(legs.map(l=>l.targetId),['sky-agents','music-console','salon-centre','language-symbol']);
 for(const leg of legs)for(let i=1;i<leg.route.points.length;i++){const a=leg.route.points[i-1],b=leg.route.points[i],m=movePlayer({x:a[0],z:a[1]},b[0]-a[0],b[1]-a[1],{walls:house.solids,radius:.22});assert.ok(Math.hypot(m.x-b[0],m.z-b[1])<1e-6);assert.equal(blocked(...b,.22,house.solids),false);}
 assert.equal(planWorkDelivery(event(),{walls:[[-17,-17,17,9]]}),null);
 const courier=createWorkCourier({now:()=>epoch,walls:house.solids});courier.setState(snapshot(event()),meta);const stages=new Set(),recipients=new Set();let home;
 for(let ms=0;ms<=170000;ms+=100){const p=courier.sample('language-symbol',ms);if(!p)continue;stages.add(p.stage);if(p.recipientId)recipients.add(p.recipientId);if(p.stage==='home'){home=p;break;}}
 assert.ok(stages.has('meeting'));assert.ok(stages.has('delivering'));assert.ok(stages.has('returning'));assert.deepEqual(recipients,new Set(['music-console','salon-centre']));assert.deepEqual(home.position,residentById('language-symbol').position);assert.equal(home.active,false);
 courier.setState(snapshot(event()),{...meta,receivedAtMs:170000});assert.equal(courier.sample('language-symbol',170100),null,'a repeated receipt cannot restart its trip');
});
test('only real research results cause a sky trip; recent tools remain bounded representations',()=>{
 const tool=event({operation:'tool',workerId:'music-mixer',sourceCount:0,modelSteps:0,artifactCount:1,status:'applied'}),courier=createWorkCourier({now:()=>epoch});courier.setState(snapshot(tool),meta);
 assert.equal(courier.sample('language-symbol',0),null);const work=courier.workForResident('music-mixer',0);assert.equal(work.state,'passed');assert.equal(work.gesture,true);assert.equal('workVerified' in work,false);assert.equal(courier.workForResident('music-console',0),null);
 assert.equal(planWorkDelivery(event({sourceCount:0,modelSteps:0})),null);
 const audience=residentById('cinema-audience-1'),value={at,connected:true,processes:[{id:'review',actorId:audience.id,state:'running',phase:'refute'}]};assert.equal(processForResident(value,audience,{ageMs:0}).workVerified,true);assert.equal(processForResident({...value,connected:false},audience,{ageMs:0}).workVerified,false);
});
test('disconnects and hidden intervals freeze positions, while expired receipts never replay',()=>{
 let clock=epoch;const courier=createWorkCourier({now:()=>clock});courier.setState(snapshot(event()),meta);courier.sample('language-symbol',0);const before=courier.sample('language-symbol',500);
 courier.setState(snapshot(event()),{...meta,connected:false,receivedAtMs:600});const frozen=courier.sample('language-symbol',10000);assert.deepEqual(frozen.position,before.position);assert.equal(frozen.fresh,false);assert.equal(frozen.moving,false);
 courier.setState(snapshot(event()),{...meta,receivedAtMs:11000});const resumed=courier.sample('language-symbol',11100);assert.equal(resumed.eventId,event().id);assert.notDeepEqual(resumed.position,before.position);
 const prior=courier.sample('language-symbol',11200);const hidden=courier.sample('language-symbol',120000);assert.ok(Math.hypot(hidden.position[0]-prior.position[0],hidden.position[2]-prior.position[2])<=1.91,'hidden time does not jump over route legs');
 clock+=181000;courier.setState(snapshot(event()),{...meta,receivedAtMs:182000});assert.equal(courier.sample('language-symbol',182000),null);
 const next=event({id:'work-00000000-0000-4000-8000-000000000002',at:new Date(clock).toISOString(),startedAt:new Date(clock).toISOString()});courier.setState(snapshot(next),{...meta,receivedAtMs:183000});assert.equal(courier.sample('language-symbol',183000).eventId,next.id);
});
test('reduced motion retains real assignments without producing courier walks',()=>{const courier=createWorkCourier({now:()=>epoch,reducedMotion:true});courier.setState(snapshot(event()),meta);assert.equal(courier.sample('language-symbol',0),null);assert.equal(courier.workForResident('lab-desk',0).recorded,true);});
test('scene journeys and recent result gestures never turn completed receipts into running processes',t=>{
 const house=geometry(t),scene=new THREE.Scene(),textures=[],creatures=createProcessCreatures(scene,textures,{now:()=>epoch,walls:house.solids});t.after(()=>{creatures.dispose();for(const texture of textures)texture.dispose();});
 const state={at,connected:true,processes:[],houseWork:snapshot(event())};creatures.setState(state,0);creatures.update(0);const home=creatures.positionForResident('language-symbol');creatures.update(5);assert.notDeepEqual(creatures.positionForResident('language-symbol'),home);
 const work=scene.getObjectByName('atlas-process-bodies').userData.work,messenger=work.find(w=>w.id==='language-symbol'),worker=work.find(w=>w.id==='lab-desk');assert.equal(messenger.journey.id,event().id);assert.equal(messenger.workVerified,false);assert.equal(worker.houseWork.eventId,event().id);assert.equal(worker.workVerified,false);assert.equal(worker.state,'waiting');
});
