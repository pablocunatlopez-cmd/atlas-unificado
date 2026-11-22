import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureAtlasLocalInference} from './atlas-local-inference-probe.mjs';
test('reports elapsed time and explicitly scoped RSS',async()=>{
 const readings=[100*1048576,110*1048576],times=[10,25];
 const result=await measureAtlasLocalInference({
  infer:async()=>({answer:'OK'}),
  readMemory:()=>readings.shift(),clock:()=>times.shift()
 });
 assert.equal(result.status,'completed');
 assert.equal(result.elapsedMs,15);
 assert.equal(result.hostProcessRssDeltaMb,10);
 assert.equal(result.memoryScope,'host_process_only_not_llama_server');
 assert.equal(result.measuredOnUserMachine,false);
});
test('reports failed inference without inventing model results',async()=>{
 const result=await measureAtlasLocalInference({
  infer:async()=>{throw Error('unavailable');},
  readMemory:()=>0,clock:(()=>{let t=0;return()=>++t;})()
 });
 assert.equal(result.status,'failed');
 assert.equal(result.error,'unavailable');
 assert.equal(result.responseChars,null);
});
