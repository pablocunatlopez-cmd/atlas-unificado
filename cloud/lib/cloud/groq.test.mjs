import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateCloud,reserveInference,pauseInference,CLOUD_MODEL} from './groq.mjs';
const messages=[{role:'user',content:'Una pregunta pública'}];
test('inference uses only Groq and the fixed model, hides reasoning and bounds output',async()=>{
 let reservations=0;
 const answer=await generateCloud({apiKey:'test-secret',messages,maxTokens:99999,reserve:async()=>{reservations++;},fetcher:async(url,init)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(init.redirect,'manual');
  const body=JSON.parse(init.body);assert.equal(body.model,CLOUD_MODEL);assert.equal(body.max_completion_tokens,1800);assert.equal(body.reasoning_format,'hidden');assert.equal(body.reasoning_effort,'none');
  return Response.json({choices:[{finish_reason:'stop',message:{content:'Respuesta'}}]});
 }});
 assert.equal(answer,'Respuesta');assert.equal(reservations,1);
});
test('quota rejection pauses instead of retrying or changing providers, without exposing the response',async()=>{
 let calls=0,paused;
 await assert.rejects(generateCloud({apiKey:'test-secret',messages,pause:async s=>{paused=s;},fetcher:async()=>{calls++;return new Response('test-secret internal detail',{status:429,headers:{'retry-after':'300'}});}}),e=>e.code==='quota'&&!e.message.includes('test-secret'));
 assert.equal(calls,1);assert.equal(paused,300);
});
test('incomplete and invalid structured output cannot become a saved conclusion',async()=>{
 for(const value of [{finish_reason:'length',message:{content:'{"conclusion":"unfinished"}'}},{finish_reason:'stop',message:{content:'not json'}}]){
  await assert.rejects(generateCloud({apiKey:'test-secret',messages,json:true,fetcher:async()=>Response.json({choices:[value]})}),e=>e.code==='output');
 }
});
test('a redirect is rejected without forwarding credentials to another host',async()=>{
 let calls=0;
 await assert.rejects(generateCloud({apiKey:'test-secret',messages,fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://other.invalid'}});}}),e=>e.code==='provider');
 assert.equal(calls,1);
});
test('daily quota and provider cooldown are enforced atomically in real SQLite',async t=>{
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this;},async run(){return sql.prepare(q).run(...values);},async first(){return sql.prepare(q).get(...values);}};}};
 const at=Date.parse('2026-11-10T10:00:00Z');
 await reserveInference(db,at);await pauseInference(db,300,at);
 await assert.rejects(reserveInference(db,at+299000),e=>e.code==='quota');
 await reserveInference(db,at+301000);
 const results=await Promise.allSettled(Array.from({length:70},()=>reserveInference(db,at+302000)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,58);
 assert.equal(sql.prepare('SELECT requests FROM cloud_inference_budget').get().requests,60);
 await reserveInference(db,at+86400000);
});
test('background calls leave capacity for interactive chat without raising the shared cap',async t=>{
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this;},async run(){return sql.prepare(q).run(...values);},async first(){return sql.prepare(q).get(...values);}};}};
 const at=Date.parse('2026-11-11T10:00:00Z');
 for(let i=0;i<48;i++)await reserveInference(db,at,'research');
 await assert.rejects(reserveInference(db,at,'coaching'),e=>e.code==='quota');
 for(let i=0;i<12;i++)await reserveInference(db,at,'chat');
 await assert.rejects(reserveInference(db,at,'chat'),e=>e.code==='quota');
 assert.equal(sql.prepare('SELECT requests FROM cloud_inference_budget').get().requests,60);
});
test('other authorized models stay on Groq and use their supported reasoning parameters',async()=>{
 for(const model of ['openai/gpt-oss-120b','openai/gpt-oss-20b']){
  await generateCloud({apiKey:'test-secret',messages,model,fetcher:async(url,init)=>{
   assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');const body=JSON.parse(init.body);assert.equal(body.model,model);assert.equal(body.reasoning_effort,'low');assert.equal(body.include_reasoning,false);assert.equal('reasoning_format' in body,false);
   return Response.json({choices:[{finish_reason:'stop',message:{content:'Respuesta',reasoning:'not returned'}}]});
  }});
 }
});
test('a model outside the allowlist cannot spend quota or trigger a fetch',async()=>{
 let reserved=0,calls=0;
 await assert.rejects(generateCloud({apiKey:'test-secret',messages,model:'arbitrary-model',reserve:async()=>{reserved++;},fetcher:async()=>{calls++;return Response.json({});}}),e=>e.code==='model');
 assert.equal(reserved,0);assert.equal(calls,0);
});
