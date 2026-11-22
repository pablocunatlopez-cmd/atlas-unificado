import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAgentWorkflow} from './bounded-agent-workflow.mjs';

test('executes only allowlisted steps and records audit events',async()=>{
 const result=await runAgentWorkflow({steps:[{kind:'plan',input:2},{kind:'verify',input:3}],
   handlers:{plan:async n=>n*2,verify:async n=>n+1}});
 assert.equal(result.ok,true);
 assert.deepEqual(result.results,[4,4]);
 assert.deepEqual(result.events.map(x=>x.status),['started','completed','started','completed']);
});
test('rejects unapproved tool calls',async()=>{
 await assert.rejects(runAgentWorkflow({steps:[{kind:'shell'}],handlers:{plan:async()=>1}}),/Unapproved/);
});
test('enforces step count budget',async()=>{
 await assert.rejects(runAgentWorkflow({steps:[{kind:'a'},{kind:'a'}],handlers:{a:async()=>1},maxSteps:1}));
});
test('stops after a failed step without running later steps',async()=>{
 let later=false;
 const result=await runAgentWorkflow({steps:[{kind:'fail'},{kind:'later'}],handlers:{
   fail:async()=>{throw Error('sensitive error');},later:async()=>{later=true;}
 }});
 assert.equal(result.ok,false);
 assert.equal(result.failedAt,0);
 assert.equal(later,false);
 assert.equal(JSON.stringify(result.events).includes('sensitive error'),false);
});
test('aborts non-cooperative handlers at timeout from caller perspective',async()=>{
 const result=await runAgentWorkflow({steps:[{kind:'slow'}],handlers:{slow:()=>new Promise(()=>{})},timeoutMs:120});
 assert.equal(result.ok,false);
});

test('timeout stops the workflow before any later step is started',async()=>{
 let later=false;
 const result=await runAgentWorkflow({steps:[{kind:'slow'},{kind:'later'}],
  handlers:{slow:()=>new Promise(()=>{}),later:async()=>{later=true;}},
  timeoutMs:120});
 assert.equal(result.ok,false);
 assert.equal(result.failedAt,0);
 assert.equal(later,false);
 assert.deepEqual(result.events.map(e=>e.status),['started','failed']);
});
