import test from 'node:test';
import assert from 'node:assert/strict';
import {chat,CHAT_MODEL} from './chat.mjs';
import {BASELINE_INFERENCE_URL,createLocalInferenceRouter} from './local-inference-router.mjs';

const MODEL='qwen3:4b',OLLAMA='http://127.0.0.1:11434',ALTERNATIVE=OLLAMA+'/v1/chat/completions';
const route=Object.freeze({runtimeId:'ollama',model:MODEL,fallback:true});
const baselineRoute=Object.freeze({runtimeId:'llama.cpp',model:CHAT_MODEL,fallback:false});
const key='fixture-baseline-only-key',question={messages:[{role:'user',content:'17 por 23 en una frase'}]};
const noReview={cognitiveCore:{decide:async()=>({review:false})}};
const answer=text=>Response.json({choices:[{message:{content:text},finish_reason:'stop'}],usage:{completion_tokens:8}});
const unavailable=()=>new Response('fixture unavailable',{status:503});
const run=(input,request,runtime=noReview)=>chat(input,[],request,key,'',null,'',[],'',runtime);

// Exercise the real inventory parser and router; every transport is mocked.
function fixture(post){
 const calls=[];
 const router=createLocalInferenceRouter({discoverLoadedAlternatives:true,request:async(url,options)=>{
  calls.push({url,options});
  if(options.method==='POST'){
   assert.ok([BASELINE_INFERENCE_URL,ALTERNATIVE].includes(url));
   return post(url,options);
  }
  assert.equal(options.method,'GET');
  assert.ok(['http://127.0.0.1:11435/health','http://127.0.0.1:11435/v1/models',OLLAMA+'/api/tags',OLLAMA+'/api/ps','http://127.0.0.1:1234/v1/models','http://127.0.0.1:1234/api/v1/models','http://127.0.0.1:8080/v1/models'].includes(url));
  if(url===OLLAMA+'/api/tags'||url===OLLAMA+'/api/ps')return Response.json({models:[{name:MODEL}]});
  return unavailable();
 }});
 return {router,calls};
}

test('chat attributes a real loaded-inventory fallback to its exact 4B alias without forwarding the baseline key',async()=>{
 const {router,calls}=fixture(url=>url===BASELINE_INFERENCE_URL?unavailable():answer('17 por 23 es 391.'));
 const result=await run(question,router.request);
 assert.equal(result.answer,'17 por 23 es 391.');assert.equal(result.model,CHAT_MODEL);assert.equal(result.modelName,MODEL+' · ollama');assert.deepEqual(result.localInference,route);assert.equal(result.trained,false);
 assert.equal(result.performance.generations.length,1);assert.deepEqual(result.performance.generations[0].localInference,route);
 const posts=calls.filter(({options})=>options.method==='POST');assert.deepEqual(posts.map(({url})=>url),[BASELINE_INFERENCE_URL,ALTERNATIVE]);
 assert.equal(new Headers(posts[0].options.headers).get('Authorization'),'Bearer '+key);
 assert.equal(JSON.parse(posts[0].options.body).model,CHAT_MODEL);
 const alternative=posts[1].options,body=JSON.parse(alternative.body);
 assert.equal(body.model,MODEL);assert.equal(body.thinking_budget_tokens,undefined);assert.equal(body.reasoning_format,undefined);assert.equal(body.chat_template_kwargs,undefined);
 assert.equal(new Headers(alternative.headers).has('Authorization'),false);assert.doesNotMatch(JSON.stringify(alternative),new RegExp(key));
 for(const {options}of calls.filter(({options})=>options.method==='GET'))assert.equal(new Headers(options.headers).has('Authorization'),false);
 assert.ok(calls.some(({url})=>url===OLLAMA+'/api/ps'));assert.equal(router.status().last.runtimeId,'ollama');
});

test('streamed fallback retains attribution after SSE becomes a chat result',async()=>{
 const events=[],text='La respuesta es 391.';
 const stream=()=>new Response('data: '+JSON.stringify({choices:[{index:0,delta:{content:text},finish_reason:'stop'}],usage:{completion_tokens:5}})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 const {router}=fixture(url=>url===BASELINE_INFERENCE_URL?unavailable():stream());
 const result=await run(question,router.request,{...noReview,onEvent:event=>events.push(event)});
 assert.equal(result.answer,text);assert.equal(result.modelName,MODEL+' · ollama');assert.deepEqual(result.localInference,route);assert.deepEqual(result.performance.generations[0].localInference,route);
 assert.equal(events.filter(event=>event.type==='delta').map(event=>event.text).join(''),text);
});

test('a failed routed review retains the draft attribution even after router status changes',async()=>{
 let alternatives=0;
 const {router,calls}=fixture(url=>url===BASELINE_INFERENCE_URL?unavailable():++alternatives===1?answer('Borrador conservado: 391.'):unavailable());
 const result=await run({...question,refute:true},router.request);
 assert.equal(result.answer,'Borrador conservado: 391.');assert.equal(result.reviewed,false);assert.match(result.reviewError,/HTTP 503/);assert.match(result.reviewScope,/borrador/);
 assert.equal(router.status().last.runtimeId,'llama.cpp');assert.equal(router.status().last.fallback,false);
 assert.equal(result.modelName,MODEL+' · ollama');assert.deepEqual(result.localInference,route);assert.equal(result.performance.generations.length,1);assert.deepEqual(result.performance.generations[0].localInference,route);
 assert.equal(calls.filter(({options})=>options.method==='POST').length,4);
});

test('successful review attribution follows the final generation in either routing direction',async()=>{
 for(const fallbackFirst of [true,false]){
  let baselineCalls=0;
  const {router}=fixture(url=>{
   if(url===ALTERNATIVE)return answer(fallbackFirst?'Borrador alternativo.':'Final alternativo.');
   baselineCalls++;return (baselineCalls===1)===fallbackFirst?unavailable():answer(fallbackFirst?'Final base.':'Borrador base.');
  });
  const result=await run({...question,refute:true},router.request);
  const finalRoute=fallbackFirst?baselineRoute:route;
  assert.equal(result.reviewed,true);assert.equal(result.answer,fallbackFirst?'Final base.':'Final alternativo.');assert.deepEqual(result.localInference,finalRoute);
  assert.equal(result.modelName,fallbackFirst?process.env.ATLAS_CHAT_MODEL_NAME||'Qwen local':MODEL+' · ollama');
  assert.deepEqual(result.performance.generations.map(generation=>generation.localInference),fallbackFirst?[route,baselineRoute]:[baselineRoute,route]);
 }
});

test('legacy fetch adapters preserve their request and response contract without routing metadata',async()=>{
 const calls=[],request=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({choices:[{message:{content:'Respuesta clásica.'},finish_reason:'stop'}],usage:{completion_tokens:3}})};};
 const result=await run(question,request);
 assert.equal(calls.length,1);assert.equal(calls[0].url,BASELINE_INFERENCE_URL);assert.equal(new Headers(calls[0].options.headers).get('Authorization'),'Bearer '+key);
 const body=JSON.parse(calls[0].options.body);assert.equal(body.model,CHAT_MODEL);assert.equal(body.reasoning_format,'deepseek');assert.equal(typeof body.chat_template_kwargs.enable_thinking,'boolean');
 assert.equal(result.answer,'Respuesta clásica.');assert.equal(result.tokens,3);assert.equal(result.modelName,process.env.ATLAS_CHAT_MODEL_NAME||'Qwen local');assert.equal(Object.hasOwn(result,'localInference'),false);assert.equal(Object.hasOwn(result.performance.generations[0],'localInference'),false);
});
