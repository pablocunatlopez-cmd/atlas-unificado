import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseAtlasLocalCpu} from './atlas-local-cpu-diagnostics.mjs';
const healthy=async()=>({ok:true,text:async()=>JSON.stringify({status:'ok'})});
test('reports candidate readiness but not validated inference',async()=>{
 const result=await diagnoseAtlasLocalCpu({freeRamMb:8000,fetchImpl:healthy});
 assert.equal(result.status,'candidate_ready');
 assert.equal(result.readyForRealInference,true);
 assert.equal(result.inferenceTested,false);
 assert.equal(result.modelLoadedVerified,false);
});
test('flags memory pressure even when server is ready',async()=>{
 const result=await diagnoseAtlasLocalCpu({freeRamMb:500,fetchImpl:healthy});
 assert.equal(result.status,'memory_attention');
 assert.equal(result.readyForRealInference,false);
 assert.equal(result.changesApplied,false);
});
test('flags server failure without assuming model is usable',async()=>{
 const result=await diagnoseAtlasLocalCpu({
  freeRamMb:8000,fetchImpl:async()=>{throw Error('offline');}
 });
 assert.equal(result.status,'server_attention');
 assert.equal(result.llama.ready,false);
});
