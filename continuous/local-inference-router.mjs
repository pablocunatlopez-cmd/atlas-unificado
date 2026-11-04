import {LOCAL_RUNTIME_OPTIONS,probeLocalRuntimes} from './runtime-options.mjs';

export const BASELINE_INFERENCE_URL='http://127.0.0.1:11435/v1/chat/completions';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const failure=code=>Object.assign(new Error('Inferencia local: '+code+'.'),{code});
const routeAlias=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:@+-]{0,159}$/.test(value)&&!/^sk-|^hf_|^eyJ/i.test(value)&&!value.toLowerCase().endsWith('.gguf');
const retryable=new Set([502,503,504]);
function cancel(response){try{void response?.body?.cancel().catch(()=>{});}catch{}}
async function waitForAbort(pending,signal){
 signal.throwIfAborted();let abort;
 const aborted=new Promise((_,reject)=>{abort=()=>reject(signal.reason||failure('cancelled'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 try{return await Promise.race([pending,aborted]);}finally{signal.removeEventListener('abort',abort);}
}
async function fetchHeaders(request,url,options){
 options.signal.throwIfAborted();
 const pending=Promise.resolve().then(()=>{options.signal.throwIfAborted();return request(url,options);});
 void pending.then(response=>{if(options.signal.aborted)cancel(response);},()=>{});
 const response=await waitForAbort(pending,options.signal);options.signal.throwIfAborted();if(response.redirected||response.status>=300&&response.status<400){cancel(response);throw failure('redirect_forbidden');}return response;
}

/** A fetch adapter for existing Atlas inference calls. Baseline-only by default.
 * Explicit fallbacks require a fresh, exact loaded-model observation; downloaded
 * inventories cannot enable them. It never starts a process or invokes a model
 * management API. A server can still evict a model between observation and use.
 * Once any successful response is returned, its stream is owned by the caller:
 * consumption errors never trigger another generation on a different runtime.
 */
export function createLocalInferenceRouter(options={}){
 if(!record(options))throw new TypeError('Opciones del enrutador no válidas.');
 for(const key of Object.keys(options))if(!['request','probe','alternatives','discoverLoadedAlternatives','timeoutMs','now'].includes(key))throw failure('custom_connection_forbidden');
 const {request=globalThis.fetch,probe=probeLocalRuntimes,alternatives=[],discoverLoadedAlternatives=false,timeoutMs=150000,now=Date.now}=options;
 if(typeof request!=='function'||typeof probe!=='function'||typeof now!=='function'||typeof discoverLoadedAlternatives!=='boolean'||!Number.isSafeInteger(timeoutMs)||timeoutMs<25||timeoutMs>180000||!Array.isArray(alternatives)||alternatives.length>3)throw new TypeError('Configuración del enrutador no válida.');
 const routes=[],seen=new Set();
 for(const alternative of alternatives){
  if(!record(alternative)||Object.keys(alternative).some(key=>!['runtimeId','model'].includes(key))||!['ollama','lm-studio','localai'].includes(alternative.runtimeId)||!routeAlias(alternative.model))throw failure('invalid_local_route');
  const key=alternative.runtimeId+':'+alternative.model;if(seen.has(key))throw failure('duplicate_local_route');seen.add(key);
  routes.push(Object.freeze({runtimeId:alternative.runtimeId,model:alternative.model,url:LOCAL_RUNTIME_OPTIONS.find(runtime=>runtime.id===alternative.runtimeId).url+'/v1/chat/completions'}));
 }
 let last=null;
 const responseRoutes=new WeakMap();
 const routeFor=response=>response!==null&&(typeof response==='object'||typeof response==='function')?responseRoutes.get(response)||null:null;
 const remember=(response,runtimeId,model,fallback)=>{
  if(response!==null&&(typeof response==='object'||typeof response==='function'))responseRoutes.set(response,Object.freeze({runtimeId,model,fallback}));
  return response;
 };
 const status=()=>({baseline:{runtimeId:'llama.cpp',model:'atlas-local'},automaticProcessStart:false,automaticModelDownload:false,discoverLoadedAlternatives,selectionHeuristic:'qwen-name-preference',modelQualityMeasured:false,alternativeCount:routes.length,alternatives:routes.map(({runtimeId,model})=>({runtimeId,model})),last:last?{...last}:null});
 async function routedRequest(url,init={}){
  if(url!==BASELINE_INFERENCE_URL||!record(init)||init.method!=='POST'||typeof init.body!=='string'||Buffer.byteLength(init.body)>256*1024)throw failure('invalid_inference_request');
  for(const key of Object.keys(init))if(!['method','headers','body','signal','redirect','credentials','referrerPolicy'].includes(key))throw failure('invalid_inference_request');
  let body;try{body=JSON.parse(init.body);}catch{throw failure('invalid_inference_request');}
  if(!record(body)||body.model!=='atlas-local'||!Array.isArray(body.messages)||body.messages.length>1000)throw failure('invalid_inference_request');
  init.signal?.throwIfAborted();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(failure('timeout')),timeoutMs);
  // Keep a deadline for the returned stream too; the timer is unref'ed so a
  // completed test or shutdown does not wait for an unconsumed Response.
  timer.unref?.();
  const signal=init.signal?AbortSignal.any([init.signal,controller.signal]):controller.signal;
  const incoming=new Headers(init.headers),baselineHeaders={'Content-Type':'application/json',Accept:incoming.get('Accept')||'application/json'};
  const authorization=incoming.get('Authorization');if(authorization)baselineHeaders.Authorization=authorization;
  const baselineOptions={method:'POST',headers:baselineHeaders,body:init.body,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal};
  let baselineResponse;
  try{baselineResponse=await fetchHeaders(request,BASELINE_INFERENCE_URL,baselineOptions);}
  catch(error){if(signal.aborted){clearTimeout(timer);throw init.signal?.aborted?init.signal.reason:failure('timeout');}if(error?.code==='redirect_forbidden'){clearTimeout(timer);throw error;}}
  const stamp=()=>new Date(now()).toISOString();
  if(baselineResponse&&!retryable.has(baselineResponse.status)){
   last={at:stamp(),runtimeId:'llama.cpp',model:'atlas-local',fallback:false,inferenceVerified:false,reason:baselineResponse.ok?'response_headers':'http_error'};
   return remember(baselineResponse,'llama.cpp','atlas-local',false);
  }
  if(!routes.length&&!discoverLoadedAlternatives){
   last={at:stamp(),runtimeId:'llama.cpp',model:'atlas-local',fallback:false,inferenceVerified:false,reason:baselineResponse?'http_error':'unavailable'};
   if(baselineResponse)return remember(baselineResponse,'llama.cpp','atlas-local',false);clearTimeout(timer);throw failure('baseline_unavailable');
  }
  let snapshot;
  try{snapshot=await waitForAbort(Promise.resolve().then(()=>{signal.throwIfAborted();return probe({request,signal,timeoutMs:Math.min(1500,timeoutMs)});}),signal);}catch{snapshot=null;}
  if(signal.aborted){cancel(baselineResponse);clearTimeout(timer);throw init.signal?.aborted?init.signal.reason:failure('timeout');}
  const sampledAt=typeof snapshot?.checkedAt==='string'?Date.parse(snapshot.checkedAt):NaN,age=now()-sampledAt;
  const fresh=Number.isFinite(age)&&age>=0&&age<=5000&&snapshot?.readOnly===true;
  const runtimes=Array.isArray(snapshot?.runtimes)?snapshot.runtimes.slice(0,4):[],candidates=[...routes];
  if(discoverLoadedAlternatives&&fresh){
   const discovered=[];
   for(const runtime of runtimes){
    // LocalAI's inventory does not establish that a model is already loaded.
    if(!['ollama','lm-studio'].includes(runtime?.id)||runtime.endpointCompatible!==true||runtime.loadedInventoryAvailable!==true||!Array.isArray(runtime.loadedRouteModelIds))continue;
    for(const model of runtime.loadedRouteModelIds.slice(0,32)){
     if(!routeAlias(model)||candidates.some(route=>route.runtimeId===runtime.id&&route.model===model)||discovered.some(route=>route.runtimeId===runtime.id&&route.model===model))continue;
     discovered.push({runtimeId:runtime.id,model,url:LOCAL_RUNTIME_OPTIONS.find(option=>option.id===runtime.id).url+'/v1/chat/completions'});
    }
   }
   // This is an explicit name preference, never a model-quality measurement.
   discovered.sort((a,b)=>Number(/qwen/i.test(b.model))-Number(/qwen/i.test(a.model)));
   candidates.push(...discovered.slice(0,2));
  }
  for(const route of candidates){
   const runtime=fresh&&runtimes.find(item=>item?.id===route.runtimeId);
   if(!runtime||runtime.endpointCompatible!==true||runtime.loadedInventoryAvailable!==true||!Array.isArray(runtime.loadedRouteModelIds)||!runtime.loadedRouteModelIds.includes(route.model))continue;
   const alternativeBody={...body,model:route.model};
   // llama.cpp-specific reasoning controls are not portable OpenAI parameters.
   for(const key of ['thinking_budget_tokens','reasoning_format','chat_template_kwargs'])delete alternativeBody[key];
   let response;
   try{response=await fetchHeaders(request,route.url,{method:'POST',headers:{'Content-Type':'application/json',Accept:baselineHeaders.Accept},body:JSON.stringify(alternativeBody),redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal});}
   catch(error){if(signal.aborted){cancel(baselineResponse);clearTimeout(timer);throw init.signal?.aborted?init.signal.reason:failure('timeout');}if(error?.code==='redirect_forbidden'){cancel(baselineResponse);clearTimeout(timer);throw error;}continue;}
   if(!response.ok){cancel(response);continue;}
   cancel(baselineResponse);last={at:stamp(),runtimeId:route.runtimeId,model:route.model,fallback:true,inferenceVerified:false,reason:'response_headers'};return remember(response,route.runtimeId,route.model,true);
  }
  last={at:stamp(),runtimeId:'llama.cpp',model:'atlas-local',fallback:false,inferenceVerified:false,reason:'no_loaded_alternative'};
  if(baselineResponse)return remember(baselineResponse,'llama.cpp','atlas-local',false);
  clearTimeout(timer);throw failure('no_loaded_alternative');
 }
 Object.defineProperty(routedRequest,'routeFor',{value:routeFor});
 return {request:routedRequest,status,routeFor};
}
