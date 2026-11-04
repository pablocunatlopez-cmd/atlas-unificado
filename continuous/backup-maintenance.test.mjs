import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackupMaintenance} from './backup-maintenance.mjs';
const DAY=86400000,instant=Date.parse('2026-11-03T19:00:00Z');
const proof={status:'verified',integrity:'ok',sha256:'a'.repeat(64),bytes:2048};
const jobs=[{id:'library',sourcePath:'library.sqlite',outputDir:'backups'},{id:'assessment',sourcePath:'assessment.sqlite',outputDir:'assessment-backups'}];
function fixture(overrides={}){const states={},calls=[],saves=[];let time=instant;const maintenance=createBackupMaintenance({jobs,readState:async id=>states[id]||{},writeState:async(id,state)=>{saves.push({id,state:structuredClone(state)});states[id]=structuredClone(state);},backup:async input=>{calls.push(input);return proof;},now:()=>time,...overrides});return {maintenance,states,calls,saves,advance:ms=>{time+=ms;}};}

test('independent sources are backed up with saved intention and only verified proof advances success',async()=>{
 const f=fixture();const result=await f.maintenance.tick();assert.deepEqual(result.jobs.map(j=>j.status),['verified','verified']);assert.equal(f.calls.length,2);assert.equal(f.saves.length,4);assert.equal(f.saves[0].state.at,undefined);assert.equal(f.saves[0].state.lastAttempt,new Date(instant).toISOString());assert.equal(f.states.library.lastError,null);assert.equal(f.states.assessment.at,new Date(instant).toISOString());
 const current=await f.maintenance.tick();assert.deepEqual(current.jobs.map(j=>j.status),['current','current']);assert.equal(f.calls.length,2);
});

test('failed source never prevents another backup and retries after 30 minutes rather than 24 hours',async()=>{
 const calls=[];const f=fixture({backup:async input=>{calls.push(input);if(input.sourcePath==='library.sqlite')throw Error('external_lookup_failed private-data');return proof;}});
 const result=await f.maintenance.tick();assert.deepEqual(result.jobs.map(j=>j.status),['failed','verified']);assert.equal(f.states.library.at,undefined);assert.equal(f.states.library.lastError.code,'backup-failed');assert.doesNotMatch(JSON.stringify(result),/private-data|external_lookup/);
 assert.deepEqual((await f.maintenance.tick()).jobs.map(j=>j.status),['deferred','current']);f.advance(30*60000);assert.equal((await f.maintenance.tick()).jobs[0].status,'failed');assert.equal(calls.length,3);
});

test('a failure preserves the previous verified snapshot and its timestamp',async()=>{
 const f=fixture({backup:async()=>{throw Error('failed');}});const old={...proof,at:new Date(instant-2*DAY).toISOString(),path:'retained-snapshot.sqlite'};f.states.library=old;await f.maintenance.tick();assert.equal(f.states.library.path,old.path);assert.equal(f.states.library.at,old.at);assert.equal(f.states.library.sha256,old.sha256);assert.equal(f.states.library.lastError.code,'backup-failed');
});

test('missing ledger is deferred without fabricating a verified backup',async()=>{
 const f=fixture({sourceExists:async source=>source!=='assessment.sqlite'});const r=await f.maintenance.tick();assert.equal(r.jobs[1].status,'failed');assert.equal(r.jobs[1].code,'source-missing');assert.equal(f.calls.length,1);assert.equal(f.states.assessment.at,undefined);
});

test('concurrent callers share one operation and no duplicate snapshots',async()=>{
 let release;const waiting=new Promise(resolve=>{release=resolve;});let calls=0;const f=fixture({backup:async()=>{calls++;await waiting;return proof;}});
 const first=f.maintenance.tick(),second=f.maintenance.tick();assert.strictEqual(first,second);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);release();await first;assert.equal(calls,2);
});

test('persistence failure before snapshot prevents work; malformed proof is never accepted',async()=>{
 let calls=0;const f=fixture({writeState:async()=>{throw Error('disk full');},backup:async()=>{calls++;return proof;}});assert.equal((await f.maintenance.tick()).jobs[0].status,'state-unavailable');assert.equal(calls,0);
 for(const bad of [{...proof,integrity:'failed'},{...proof,sha256:'bad'},{...proof,bytes:0},{...proof,status:'partial'}]){const g=fixture({backup:async()=>bad});assert.equal((await g.maintenance.tick()).jobs[0].status,'failed');assert.equal(g.states.library.at,undefined);}
});

test('cancelled maintenance starts no new job and records a snapshot that completed during cancellation',async()=>{
 const controller=new AbortController(),f=fixture({backup:async()=>{controller.abort(Error('stop'));return proof;}});
 await assert.rejects(f.maintenance.tick({signal:controller.signal}),/stop/);assert.equal(f.states.library.integrity,'ok');assert.equal(f.states.assessment,undefined);
 const stopped=new AbortController();stopped.abort(Error('already stopped'));assert.throws(()=>f.maintenance.tick({signal:stopped.signal}),/already stopped/);
});

test('clock anomalies and malformed configuration cannot manufacture future success',async()=>{
 const f=fixture();f.states.library={at:new Date(instant+DAY).toISOString(),lastAttempt:new Date(instant+DAY).toISOString()};await f.maintenance.tick();assert.equal(f.states.library.at,new Date(instant).toISOString());
 assert.throws(()=>createBackupMaintenance({jobs:[jobs[0],jobs[0]],readState:async()=>({}),writeState:async()=>{},backup:async()=>proof}),/Origen/);
 const bad=fixture({now:()=>NaN});await assert.rejects(bad.maintenance.tick(),/Reloj/);
});
