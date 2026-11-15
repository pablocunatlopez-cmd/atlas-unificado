import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSessionLiveWork, readSessionLiveWork} from './session-live-work-gate.mjs';

test('reported active sessions alone cannot authorize live work', () => {
  const result = evaluateSessionLiveWork({liveCycleEnabled:true,activeSessions:64,recent:[]});
  assert.equal(result.mayStartLiveWork,false);
  assert.equal(result.reason,'no_fresh_opt_in');
});

test('fresh explicit consent and enabled cycle are both required', () => {
  const row={ageMs:1000,allowsWork:true};
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled:true,recent:[row]}).mayStartLiveWork,true);
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled:false,recent:[row]}).mayStartLiveWork,false);
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled:true,recent:[{ageMs:1000}]}).mayStartLiveWork,false);
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled:true,recent:[{ageMs:1000,allowsWork:false}]}).mayStartLiveWork,false);
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled:true,recent:[{ageMs:120001,allowsWork:true}]}).mayStartLiveWork,false);
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled:true,recent:[{ageMs:-1,allowsWork:true}]}).mayStartLiveWork,false);
});

test('untrusted origin and network failure fail closed',async()=>{
  let calls=0;
  const request=async()=>{calls++;return Response.json({liveCycleEnabled:true,recent:[{ageMs:0,allowsWork:true}]});};
  assert.equal((await readSessionLiveWork('http://atlas.example/',{request})).mayStartLiveWork,false);
  assert.equal((await readSessionLiveWork('https://atlas.example/redirect',{request})).mayStartLiveWork,false);
  assert.equal(calls,0);
  assert.equal((await readSessionLiveWork('https://atlas.example/',{request})).mayStartLiveWork,true);
  assert.equal(calls,1);
  assert.equal((await readSessionLiveWork('https://atlas.example/',{request:async()=>{throw Error('offline');}})).mayStartLiveWork,false);
});

test('a stale timestamp cannot be revived by a forged fresh ageMs',()=>{
  const now=Date.parse('2026-11-15T19:00:00Z');
  const stale=new Date(now-600000).toISOString();
  const result=evaluateSessionLiveWork({liveCycleEnabled:true,activeSessions:1,recent:[{allowsWork:true,ageMs:0,at:stale}]},{now});
  assert.equal(result.mayStartLiveWork,false);
  assert.equal(result.reason,'no_fresh_opt_in');
});
