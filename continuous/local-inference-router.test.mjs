import test from 'node:test';
import assert from 'node:assert/strict';
import {BASELINE_INFERENCE_URL,createLocalInferenceRouter} from './local-inference-router.mjs';
const now=()=>Date.parse('2026-11-03T12:00:00Z');
const init=(extras={})=>({method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer private-baseline-key',Cookie:'private-cookie','X-API-Key':'private-other'},body:JSON.stringify({model:'atlas-local',messages:[{role:'user',content:'2+2'}],stream:true,thinking_budget_tokens:0,reasoning_format:'deepseek',chat_template_kwargs:{enable_thinking:false},max_tokens:12}),...extras});
const snapshot=(patch={})=>({readOnly:true,checkedAt:new Date(now()).toISOString(),runtimes:[{id:'ollama',endpointCompatible:true,loadedInventoryAvailable:true,loadedRouteModelIds:['qwen3:4b'],models:[{id:'qwen3:4b'}]}],...patch});

test('baseline-only default preserves response streams and never probes alternatives',async()=>{
 let calls=0,probes=0;const response=new Response('stream text');
 const router=createLocalInferenceRouter({probe:async()=>{probes++;},request:async(url,options)=>{calls++;assert.equal(url,BASELINE_INFERENCE_URL);assert.equal(options.headers.Authorization,'Bearer private-baseline-key');assert.equal(options.headers.Cookie,undefined);return response;},now});
 assert.equal(await router.request(BASELINE_INFERENCE_URL,init()),response);assert.equal(calls,1);assert.equal(probes,0);assert.equal(await response.text(),'stream text');assert.equal(router.status().last.runtimeId,'llama.cpp');assert.doesNotMatch(JSON.stringify(router.status()),/private/);
});

test('explicit failover uses a freshly loaded exact alias and strips baseline credentials',async()=>{
 const calls=[];
 const router=createLocalInferenceRouter({alternatives:[{runtimeId:'ollama',model:'qwen3:4b'}],now,probe:async options=>{assert.equal(options.request instanceof Function,true);return snapshot();},request:async(url,options)=>{
  calls.push({url,options});if(url===BASELINE_INFERENCE_URL)return new Response('busy',{status:503});
  assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');assert.deepEqual(options.headers,{'Content-Type':'application/json',Accept:'application/json'});assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  const body=JSON.parse(options.body);assert.equal(body.model,'qwen3:4b');assert.equal(body.stream,true);assert.equal(body.max_tokens,12);assert.equal(body.reasoning_format,undefined);assert.equal(body.thinking_budget_tokens,undefined);assert.equal(body.chat_template_kwargs,undefined);return new Response('four');
 }});
 const response=await router.request(BASELINE_INFERENCE_URL,init());assert.equal(await response.text(),'four');assert.equal(calls.length,2);assert.equal(router.status().last.fallback,true);assert.equal(router.status().last.inferenceVerified,false);assert.doesNotMatch(JSON.stringify(router.status()),/private/);
});

test('downloaded, stale, unauthenticated or shortened model names never enable failover',async()=>{
 for(const result of [snapshot({checkedAt:'2026-11-03T11:59:00Z'}),snapshot({readOnly:false}),snapshot({runtimes:[{id:'ollama',endpointCompatible:true,models:[{id:'qwen3:4b'}]}]}),snapshot({runtimes:[{id:'ollama',endpointCompatible:true,loadedInventoryAvailable:true,loadedModelIds:['qwen3:4b'],loadedRouteModelIds:[]}]}),snapshot({runtimes:[{id:'ollama',endpointCompatible:false,loadedInventoryAvailable:true,loadedRouteModelIds:['qwen3:4b']} ]})]){
  let calls=0;const router=createLocalInferenceRouter({alternatives:[{runtimeId:'ollama',model:'qwen3:4b'}],now,probe:async()=>result,request:async url=>{calls++;assert.equal(url,BASELINE_INFERENCE_URL);return new Response('busy',{status:503});}});
  const response=await router.request(BASELINE_INFERENCE_URL,init());assert.equal(response.status,503);assert.equal(calls,1);assert.equal(router.status().last.reason,'no_loaded_alternative');
 }
});

test('authorization, request, rate-limit and successful stream failures do not cause retries',async()=>{
 for(const code of [200,400,401,403,404,429]){
  let calls=0,probes=0;const router=createLocalInferenceRouter({alternatives:[{runtimeId:'ollama',model:'qwen3:4b'}],now,probe:async()=>{probes++;return snapshot();},request:async()=>{calls++;return new Response(code===200?new ReadableStream({pull(controller){controller.error(Error('private stream error'));}}):'error',{status:code});}});
  const response=await router.request(BASELINE_INFERENCE_URL,init());if(code===200)await assert.rejects(response.text(),/private stream error/);assert.equal(calls,1);assert.equal(probes,0);
 }
});

test('network errors can use only explicitly selected loaded local alternatives',async()=>{
 let calls=0;const router=createLocalInferenceRouter({alternatives:[{runtimeId:'ollama',model:'qwen3:4b'}],now,probe:async()=>snapshot(),request:async url=>{calls++;if(url===BASELINE_INFERENCE_URL)throw Error('private address/key');return new Response('ok');}});
 assert.equal(await (await router.request(BASELINE_INFERENCE_URL,init())).text(),'ok');assert.equal(calls,2);
 const offline=createLocalInferenceRouter({request:async()=>{throw Error('private address/key');}});await assert.rejects(offline.request(BASELINE_INFERENCE_URL,init()),error=>error.code==='baseline_unavailable'&&!error.message.includes('private'));
});

test('arbitrary URLs, model file paths, duplicate routes and credential options are rejected',async()=>{
 for(const options of [{apiKey:'private'},{url:'https://evil/'},{alternatives:[{runtimeId:'remote',model:'qwen'}]},{alternatives:[{runtimeId:'ollama',model:'qwen',headers:{Authorization:'private'}}]},{alternatives:[{runtimeId:'ollama',model:'C:\\private\\Qwen.gguf'}]},{alternatives:[{runtimeId:'ollama',model:'publisher/qwen'}]},{alternatives:[{runtimeId:'ollama',model:'qwen'},{runtimeId:'ollama',model:'qwen'}]}])assert.throws(()=>createLocalInferenceRouter(options));
 let calls=0;const router=createLocalInferenceRouter({request:async()=>{calls++;return new Response();}});
 for(const [url,options] of [['https://evil/',init()],[BASELINE_INFERENCE_URL,init({method:'GET'})],[BASELINE_INFERENCE_URL,init({body:'private'})],[BASELINE_INFERENCE_URL,init({body:JSON.stringify({model:'another',messages:[]})})]])await assert.rejects(router.request(url,options));assert.equal(calls,0);
});

test('redirect rejection and caller cancellation stop failover without exposing exception details',async()=>{
 let probes=0;const redirect=createLocalInferenceRouter({alternatives:[{runtimeId:'ollama',model:'qwen3:4b'}],probe:async()=>{probes++;return snapshot();},request:async()=>new Response(null,{status:302,headers:{Location:'https://evil/private'}})});
 await assert.rejects(redirect.request(BASELINE_INFERENCE_URL,init()),error=>error.code==='redirect_forbidden');assert.equal(probes,0);
 const controller=new AbortController(),reason=Error('foreground interruption');const cancelled=createLocalInferenceRouter({alternatives:[{runtimeId:'ollama',model:'qwen3:4b'}],request:async()=>new Promise(()=>{}),probe:async()=>{probes++;return snapshot();}});
 const pending=cancelled.request(BASELINE_INFERENCE_URL,init({signal:controller.signal}));setTimeout(()=>controller.abort(reason),10);await assert.rejects(pending,error=>error===reason);assert.equal(probes,0);
});

test('one request deadline bounds a stalled fetch or a stalled injected probe',async()=>{
 const keepAlive=setTimeout(()=>{},1000);
 try{
  for(const stage of ['request','probe']){
   let calls=0;const router=createLocalInferenceRouter({timeoutMs:25,alternatives:[{runtimeId:'ollama',model:'qwen3:4b'}],request:async()=>{calls++;return stage==='request'?new Promise(()=>{}):new Response('busy',{status:503});},probe:async()=>new Promise(()=>{})});
   await assert.rejects(router.request(BASELINE_INFERENCE_URL,init()),error=>error.code==='timeout');assert.equal(calls,1);
  }
 }finally{clearTimeout(keepAlive);}
});

test('optional discovery selects at most two already-loaded alternatives with Qwen name preference',async()=>{
 const calls=[];
 const router=createLocalInferenceRouter({discoverLoadedAlternatives:true,now,probe:async()=>snapshot({runtimes:[{id:'ollama',endpointCompatible:true,loadedInventoryAvailable:true,loadedRouteModelIds:['llama3:8b','qwen3:4b','qwen3.5:9b']},{id:'localai',endpointCompatible:true,loadedInventoryAvailable:true,loadedRouteModelIds:['qwen-do-not-load']}]}),request:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,model:body.model,headers:options.headers});return new Response('unavailable',{status:503});
 }});
 const response=await router.request(BASELINE_INFERENCE_URL,init());assert.equal(response.status,503);
 assert.deepEqual(calls.map(item=>item.model),['atlas-local','qwen3:4b','qwen3.5:9b']);assert.ok(calls.every(item=>item.url.endsWith('/v1/chat/completions')));assert.ok(calls.slice(1).every(item=>item.headers.Authorization===undefined));assert.equal(router.status().discoverLoadedAlternatives,true);assert.equal(router.status().modelQualityMeasured,false);
});

test('discovery is disabled by default and empty loaded inventories never trigger another runtime',async()=>{
 for(const enabled of [false,true]){
  let calls=0,probes=0;
  const router=createLocalInferenceRouter({discoverLoadedAlternatives:enabled,now,probe:async()=>{probes++;return snapshot({runtimes:[{id:'ollama',endpointCompatible:true,loadedInventoryAvailable:true,loadedRouteModelIds:[],models:[{id:'downloaded-qwen'}]}]});},request:async()=>{calls++;return new Response('busy',{status:503});}});
  assert.equal((await router.request(BASELINE_INFERENCE_URL,init())).status,503);assert.equal(calls,1);assert.equal(probes,enabled?1:0);
 }
});

test('explicit routes stay before discovered routes, and discovered successful generation is returned',async()=>{
 const models=[];
 const router=createLocalInferenceRouter({alternatives:[{runtimeId:'ollama',model:'llama3:8b'}],discoverLoadedAlternatives:true,now,probe:async()=>snapshot({runtimes:[{id:'ollama',endpointCompatible:true,loadedInventoryAvailable:true,loadedRouteModelIds:['qwen3:4b','llama3:8b']}]}),request:async(url,options)=>{const model=JSON.parse(options.body).model;models.push(model);return new Response(model==='qwen3:4b'?'four':'busy',{status:model==='qwen3:4b'?200:503});}});
 const response=await router.request(BASELINE_INFERENCE_URL,init());assert.equal(await response.text(),'four');assert.deepEqual(models,['atlas-local','llama3:8b','qwen3:4b']);assert.equal(router.status().last.runtimeId,'ollama');assert.equal(router.status().last.model,'qwen3:4b');
});

test('per-response provenance remains correct across concurrent baseline and fallback completions',async()=>{
 let releaseBaseline;
 const baselineGate=new Promise(resolve=>{releaseBaseline=resolve;});
 const router=createLocalInferenceRouter({discoverLoadedAlternatives:true,now,probe:async()=>snapshot(),request:async(url,options)=>{
  if(url!==BASELINE_INFERENCE_URL)return new Response('fallback answer');
  const text=JSON.parse(options.body).messages[0].content;
  if(text==='deferred baseline'){await baselineGate;return new Response('baseline answer');}
  return new Response('busy',{status:503});
 }});
 const baselinePending=router.request(BASELINE_INFERENCE_URL,init({body:JSON.stringify({model:'atlas-local',messages:[{role:'user',content:'deferred baseline'}]})}));
 const fallbackResponse=await router.request(BASELINE_INFERENCE_URL,init());
 assert.deepEqual(router.routeFor(fallbackResponse),{runtimeId:'ollama',model:'qwen3:4b',fallback:true});
 releaseBaseline();const baselineResponse=await baselinePending;
 assert.notEqual(baselineResponse,fallbackResponse);assert.equal(router.status().last.runtimeId,'llama.cpp');
 assert.deepEqual(router.routeFor(baselineResponse),{runtimeId:'llama.cpp',model:'atlas-local',fallback:false});
 assert.deepEqual(router.request.routeFor(fallbackResponse),{runtimeId:'ollama',model:'qwen3:4b',fallback:true});
 assert.equal(router.routeFor(new Response('unrelated')),null);assert.equal(router.request.routeFor(null),null);
 assert.throws(()=>{router.routeFor(fallbackResponse).model='forged';},TypeError);
 assert.deepEqual(Object.keys(router.routeFor(fallbackResponse)),['runtimeId','model','fallback']);
});
