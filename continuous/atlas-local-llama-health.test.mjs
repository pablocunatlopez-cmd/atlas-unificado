import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkAtlasLocalLlamaHealth} from './atlas-local-llama-health.mjs';
test('accepts only localhost and reports readiness without claiming inference',async()=>{
 const result=await checkAtlasLocalLlamaHealth({
  fetchImpl:async(url)=>{assert.equal(url,'http://127.0.0.1:8080/health');
   return {ok:true,text:async()=>JSON.stringify({status:'ok'})};}
 });
 assert.equal(result.ready,true);
 assert.equal(result.inferenceVerified,false);
 await assert.rejects(checkAtlasLocalLlamaHealth({
  endpoint:'http://example.com:8080',fetchImpl:async()=>{throw Error('unexpected');}
 }));
});
test('rejects unhealthy and unreachable local servers',async()=>{
 const notReady=await checkAtlasLocalLlamaHealth({
  fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({status:'loading model'})})
 });
 assert.equal(notReady.ready,false);
 const unreachable=await checkAtlasLocalLlamaHealth({
  fetchImpl:async()=>{throw Error('ECONNREFUSED');}
 });
 assert.equal(unreachable.status,'unreachable');
});
