import test from 'node:test';
import assert from 'node:assert/strict';
import {RESIDENTS,WORKSTATIONS,AUDIENCE,residentById,residentIdFromHit,residentsForRoom,processForResident} from '../../public/house/residents.js';
import {ROOM_IDS,roomAt} from '../../public/house/layout.js';

test('the fixed roster covers eighteen real capability stations and all six cinema chairs',()=>{
 assert.equal(RESIDENTS.length,24);assert.equal(WORKSTATIONS.length,18);assert.equal(AUDIENCE.length,6);assert.equal(new Set(RESIDENTS.map(resident=>resident.id)).size,24);
 for(const resident of RESIDENTS){assert.equal(roomAt(resident.position[0],resident.position[2]),resident.room);assert.ok(ROOM_IDS.includes(resident.room));assert.ok(resident.position.every(Number.isFinite));assert.ok(Number.isFinite(resident.yaw));assert.ok(['human','robot','animal','bird'].includes(resident.archetype));assert.equal(typeof resident.name,'string');assert.ok(resident.name.trim());assert.ok(resident.role.trim());assert.equal(Object.isFrozen(resident),true);assert.equal(Object.isFrozen(resident.position),true);}
 for(const room of ROOM_IDS)assert.ok(residentsForRoom(room).length>=1);
 assert.deepEqual(AUDIENCE.map(resident=>[resident.position[0],resident.position[2]]).sort(),[[6.5,-2.6],[6.5,-4.3],[6.5,-6],[8.2,-2.6],[8.2,-4.3],[8.2,-6]].sort());
 assert.ok(AUDIENCE.every(resident=>resident.room==='cinema'&&resident.seated&&resident.cosmetic&&resident.processIds.length===0));
});

test('desk residents match existing seat centres, and other figures belong to the furnished work surfaces',()=>{
 for(const [id,position] of [['music-console',[-8.9,0,4]],['lab-desk',[-8.8,0,-4]],['games-desk',[8.8,0,4]],['sky-sources',[-2.3,0,-5.5]],['sky-agents',[2.3,0,-5.5]],['mind-desk',[-10,0,-13.6]]]){const resident=residentById(id);assert.deepEqual(resident.position,position);assert.equal(resident.seated,true);}
 for(const id of ['lab-bench','games-maquette','body-arm','refutation-candidate','refutation-control','language-object','language-symbol','language-meaning'])assert.equal(residentById(id).seated,false);
 assert.equal(residentById('missing'),null);assert.deepEqual(residentsForRoom('missing'),[]);
});

test('resident ray hits resolve actor instances and labels to the roster without accepting unknown targets',()=>{
 for(const resident of RESIDENTS){
  for(const [residentPartCount,instanceOffset] of [[18,17],[6,5]]){
   const object={userData:{residentRoster:RESIDENTS,residentPartCount}};
   assert.equal(residentIdFromHit({object,instanceId:RESIDENTS.indexOf(resident)*residentPartCount+instanceOffset}),resident.id);
  }
  assert.equal(residentIdFromHit({object:{userData:{residentId:resident.id}}}),resident.id);
 }
 assert.equal(residentIdFromHit({object:{userData:{residentId:'not-a-resident'}}}),null);
 assert.equal(residentIdFromHit({object:{userData:{residentRoster:RESIDENTS,residentPartCount:18}},instanceId:RESIDENTS.length*18}),null);
 assert.equal(residentIdFromHit({object:{userData:{residentRoster:RESIDENTS,residentPartCount:0}},instanceId:0}),null);
 assert.equal(residentIdFromHit({object:{userData:{residentRoster:RESIDENTS,residentPartCount:18}},instanceId:-1}),null);
});

test('work assignments are explicit, local music does not invent a PC job, and decorative audiences have no sources',()=>{
 assert.deepEqual(residentById('music-console').processIds,[]);assert.deepEqual(residentById('music-mixer').processIds,[]);
 assert.deepEqual(residentById('games-desk').processIds,['creative']);assert.deepEqual(residentById('lab-desk').processIds,['research']);
 assert.deepEqual(residentById('sky-agents').processIds,['agents']);assert.deepEqual(residentById('body-arm').processIds,['tools']);
 assert.match(residentById('body-arm').role,/software.*simbólico/);assert.ok(AUDIENCE.every(resident=>resident.processIds.length===0));
 assert.deepEqual(residentById('lab-bench').activePhases,['apply','refute']);assert.equal(new Set(RESIDENTS.map(resident=>resident.archetype)).size,4);
 const local=processForResident({processes:[]},residentById('music-console'));
 assert.equal(local.reason,'local_only');
 assert.equal(local.workVerified,false);
 const audience=processForResident({processes:[]},AUDIENCE[0]);
 assert.equal(audience.reason,'reported');
 assert.equal(audience.state,'idle');
});

test('the roster and scene share phase-specific work instead of showing every experience station as active',()=>{
 const assigned=['lab-bench','mind-desk','language-meaning'];
 const at='2026-11-02T12:00:00.000Z';
 for(const [phase,expected] of [['apply',['lab-bench']],['refute',['lab-bench']],['observe',['mind-desk']],['understand',['mind-desk']],['connect',['language-meaning']],['retain',['mind-desk','language-meaning']]]){
  const state={at,connected:true,processes:[{id:'experience',state:'running',phase}]};
  const working=assigned.filter(id=>processForResident(state,residentById(id),{ageMs:0}).workVerified);
  assert.deepEqual(working,expected,phase+' only activates its assigned stations');
  for(const id of assigned){
   const offline=processForResident({...state,connected:false},residentById(id),{ageMs:0});
   assert.equal(offline.workVerified,false);
   assert.equal(offline.reason,'disconnected');
  }
 }
 const stale=processForResident({at,connected:true,processes:[{id:'experience',state:'running',phase:'apply'}]},residentById('lab-bench'),{ageMs:80000});
 assert.equal(stale.workVerified,false);
 assert.equal(stale.reason,'stale');
 const wrongPhase=processForResident({at,connected:true,processes:[{id:'experience',state:'running',phase:'observe'}]},residentById('lab-bench'),{ageMs:0});
 assert.equal(wrongPhase.workVerified,false);
 assert.equal(wrongPhase.reason,'wrong_phase');
});
