import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runOllamaPrompt,validateOllamaOrigin} from './local-ollama-evaluation.mjs';

test('accepts only loopback HTTP origins',()=>{
 assert.equal(validateOllamaOrigin('http://127.0.0.1:11434/'),'http://127.0.0.1:11434');
 for(const origin of ['https://127.0.0.1:11434','http://192.168.1.3:11434','http://example.org','http://localhost:11434/other','http://user:pass@localhost:11434']){
   assert.throws(()=>validateOllamaOrigin(origin));
 }
});
test('executes an explicit local request and returns measured duration',async()=>{
 let called=false;
 const result=await runOllamaPrompt({model:'qwen2.5:7b',prompt:'hola',options:{temperature:0,seed:42},request:async(url,init)=>{
   called=true;
   assert.equal(url,'http://127.0.0.1:11434/api/generate');
   assert.equal(init.redirect,'error');
   const body=JSON.parse(init.body);
   assert.equal(body.stream,false);
   assert.equal(body.options.seed,42);
   return Response.json({response:'respuesta',done:true,total_duration:2000000000,eval_count:30});
 }});
 assert.equal(called,true);
 assert.equal(result.response,'respuesta');
 assert.equal(result.providerTotalMs,2000);
 assert.equal(result.outputTokens,30);
 assert.ok(result.durationMs>=0);
});
test('rejects remote origin and dangerous options before network access',async()=>{
 let called=false;
 const request=async()=>{called=true;throw Error('should not call');};
 await assert.rejects(runOllamaPrompt({model:'qwen',prompt:'hola',origin:'http://evil.test',request}));
 await assert.rejects(runOllamaPrompt({model:'qwen',prompt:'hola',options:{num_gpu:99},request}));
 await assert.rejects(runOllamaPrompt({model:'qwen',prompt:'hola',options:{temperature:NaN},request}));
 assert.equal(called,false);
});
test('rejects malformed model output',async()=>{
 await assert.rejects(runOllamaPrompt({model:'qwen',prompt:'hola',request:async()=>Response.json({response:'',done:true})}));
});
