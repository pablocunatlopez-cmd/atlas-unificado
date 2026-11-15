import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {MISSIONS,MISSION_ROTATION,missionFor,scheduledMission,MISSION_METHOD,missionTools} from '../lib/collaboration/missions.ts';
import {ERAS_CATALOG} from '../lib/collaboration/eras-catalog.ts';
import {RESIDENTS} from '../public/house/residents.js';
import {ROOMS} from '../public/house/layout.js';
import {PROCESS_CATALOG} from '../lib/core/process-telemetry.mjs';
import {publicUrl} from '../lib/research/web.ts';
import {consultInput} from '../lib/collaboration/policy.ts';
import {initialWorld,expandWorld,rememberWorldConsultation} from '../lib/evolution/world.ts';

test('all canonical rooms, processes and ERAS identities can initiate their own mission',()=>{
 const count=(kind:string)=>MISSIONS.filter(m=>m.kind===kind).length;
 assert.equal(count('resident'),24);assert.equal(count('character'),30);assert.equal(count('zone'),10);assert.equal(count('building'),5);
 for(const r of ROOMS)assert.equal(missionFor('room:'+r.id)?.name,r.title);
 for(const id of Object.keys(PROCESS_CATALOG))assert.ok(missionFor('process:'+id));
 for(const e of ERAS_CATALOG){assert.equal(missionFor(e.id)?.name,e.name);assert.equal(consultInput({requestId:'r',actorId:e.id}).actorId,e.id);}
 assert.equal(new Set(MISSIONS.map(m=>m.id)).size,MISSIONS.length);
 assert.equal(MISSION_METHOD.phases.length,6);assert.equal(MISSION_METHOD.fields.length,12);
});
test('one complete scheduled round covers every owner and interleaves visible and non-visible work',()=>{
 assert.deepEqual(new Set(MISSION_ROTATION.map(m=>m.id)),new Set(MISSIONS.map(m=>m.id)));
 assert.equal(MISSION_ROTATION.length,MISSIONS.length);assert.equal(scheduledMission(MISSIONS.length).id,scheduledMission(0).id);
 assert.equal(new Set(MISSION_ROTATION.slice(0,10).map(m=>m.kind)).size,10);
 assert.throws(()=>scheduledMission(-1));assert.throws(()=>scheduledMission(NaN));
});
test('delegates exist, targets are real files, and abstract actors do not create fake bodies',()=>{
 for(const m of MISSIONS){assert.ok(RESIDENTS.some((r:{id:string})=>r.id===m.residentId),m.id);assert.ok(m.targetFiles.length,m.id);for(const f of m.targetFiles){assert.ok(!f.startsWith('/')&&!f.split('/').includes('..'));if(m.targetProject==='atlas'||existsSync('../eras/dist/core.js'))assert.ok(existsSync((m.targetProject==='eras'?'../eras/':'')+f),m.id+':'+f);}assert.ok(m.validation.length>=2);assert.ok(m.runtime.length>10);for(const source of m.sources)assert.equal(publicUrl(source.url),source.url);}
 assert.equal(missionFor('room:music')?.residentId,'music-console');assert.equal(missionFor('music-console')?.id,'resident:music-console');assert.equal(missionFor('unknown'),undefined);
 assert.match(missionFor('process:weights')!.runtime,/Sin entrenamiento/);
});
test('old world migration preserves history and stores room and character consultations exactly once',()=>{
 const old=initialWorld();delete old.memories['room:mind'];delete old.memories['eras-character:ice:scout'];old.memories['resident:mind-desk'].conclusion='Error conservado';old.memories['resident:mind-desk'].turns=7;
 const expanded=expandWorld(old);assert.equal(expanded.memories['resident:mind-desk'].turns,7);assert.equal(expanded.memories['resident:mind-desk'].conclusion,'Error conservado');assert.ok(expanded.memories['eras-character:ice:scout']);assert.equal(old.memories['room:mind'],undefined);
 const c={id:'icarus-100',actorId:'room:mind',domain:'room-mind',question:'¿Cómo recuperar la memoria?',status:'evidence-collected',at:'2026-11-12T10:00:00Z',sources:[{id:'read'}],agents:[]} as any;
 const next=rememberWorldConsultation(old,c,'run');assert.equal(next.memories['room:mind'].turns,1);assert.equal(next.memories['room:mind'].lastRunId,'run');assert.equal(next.memories['resident:mind-desk'].turns,7);assert.equal(next.memories['room:mind'].reflections,0);assert.deepEqual(rememberWorldConsultation(next,c,'other'),next);
 const npc={...c,id:'icarus-101',actorId:'eras-character:ice:scout'};assert.equal(rememberWorldConsultation(next,npc,'run2').memories[npc.actorId].consultation?.id,npc.id);
});

test('equivalent programming and review owners can execute their appropriate bounded tools',()=>{for(const id of ['resident:body-console','room:body','module:programming','process:tools'])assert.ok(missionTools(id).includes('program-lab'));assert.ok(missionTools('room:refutation').includes('strategy-eval'));assert.equal(missionTools('eras-character:ice:warrior').includes('program-lab'),false);assert.notDeepEqual(missionFor('domain:salud')!.sources,missionFor('resident:salon-centre')!.sources);});
