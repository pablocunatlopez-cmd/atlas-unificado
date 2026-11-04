import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Runtime software, model weights and hosted providers are separate inventories.
// This module never generates text, downloads weights, starts or changes a model.
export const LOCAL_RUNTIME_OPTIONS=Object.freeze([
 Object.freeze({id:'llama.cpp',label:'llama.cpp',url:'http://127.0.0.1:11435',inventoryPath:'/v1/models',documentation:'https://github.com/ggml-org/llama.cpp/tree/master/tools/server'}),
 Object.freeze({id:'ollama',label:'Ollama',url:'http://127.0.0.1:11434',inventoryPath:'/api/tags',documentation:'https://docs.ollama.com/api/tags'}),
 Object.freeze({id:'lm-studio',label:'LM Studio',url:'http://127.0.0.1:1234',inventoryPath:'/v1/models',documentation:'https://lmstudio.ai/docs/developer/core/server'}),
 Object.freeze({id:'localai',label:'LocalAI',url:'http://127.0.0.1:8080',inventoryPath:'/v1/models',documentation:'https://localai.io/docs/getting-started/'}),
]);

export const PROVIDER_ACCESS_OPTIONS=Object.freeze([
 Object.freeze({id:'groq',label:'Groq',kind:'hosted-provider',access:'limited-free-plan',apiKeyRequired:true,credentialsVerified:false,quotaVerified:false,checkedOn:'2026-11-03',summary:'Plan gratuito sujeto a límites por modelo y organización; requiere cuenta y clave propias.',documentation:'https://console.groq.com/docs/rate-limits'}),
 Object.freeze({id:'cerebras',label:'Cerebras',kind:'hosted-provider',access:'expiring-trial',apiKeyRequired:true,credentialsVerified:false,quotaVerified:false,checkedOn:'2026-11-03',summary:'Prueba de 5 USD durante 30 días tras verificar un método de pago; no es una cuota gratuita renovable.',documentation:'https://inference-docs.cerebras.ai/support/rate-limits'}),
 Object.freeze({id:'hugging-face',label:'Hugging Face Inference Providers',kind:'hosted-provider',access:'paid-credits-required',apiKeyRequired:true,credentialsVerified:false,quotaVerified:false,checkedOn:'2026-11-03',summary:'La cuenta Free no incluye créditos mensuales; PRO incluye 2 USD al mes con una suscripción de pago.',documentation:'https://huggingface.co/docs/inference-providers/en/pricing'}),
]);

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const failure=code=>Object.assign(new Error('Inventario local: '+code+'.'),{code});
const bytes=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const bounded=(value,defaultValue,min,max)=>value===undefined?defaultValue:Number.isSafeInteger(value)&&value>=min&&value<=max?value:(()=>{throw new TypeError('Límite de inventario no válido.');})();
function optionsOnly(options,allowed){
 if(!record(options))throw new TypeError('Opciones de inventario no válidas.');
 for(const key of Object.keys(options))if(!allowed.includes(key))throw failure('custom_connection_forbidden');
}
function modelName(value){
 if(typeof value!=='string'||value.length>4096||/^[a-z]+:\/\//i.test(value))return null;
 const name=value.split(/[\\/]/).at(-1);
 return /^[A-Za-z0-9][A-Za-z0-9_.:+@ -]{0,159}$/.test(name)&&!/^sk-|^hf_|^Bearer\b|^eyJ/i.test(name)&&name!=='.'&&name!=='..'?name:null;
}
function modelsFrom(payload,id){
 const supplied=id==='ollama'?payload?.models:payload?.data;
 if(!Array.isArray(supplied))throw failure('invalid_inventory');
 const models=[],seen=new Set();
 for(const item of supplied.slice(0,128)){
  const name=modelName(id==='ollama'?item?.name||item?.model:item?.id);
  if(!name||seen.has(name))continue;
  const sizeBytes=bytes(id==='ollama'?item?.size:item?.meta?.size);
  models.push({id:name,...(sizeBytes===null?{}:{sizeBytes})});seen.add(name);
  if(models.length===32)break;
 }
 return models;
}
function loadedFrom(payload,id){
 const raw=[];
 if(id==='ollama'||id==='llama.cpp'){
  const models=id==='ollama'?payload?.models:payload?.data;if(!Array.isArray(models))throw failure('invalid_inventory');
  for(const model of models.slice(0,128))raw.push(id==='ollama'?model?.name||model?.model:model?.id);
 }else{
  if(!Array.isArray(payload?.models))throw failure('invalid_inventory');
  for(const model of payload.models.slice(0,128)){
   if(model?.type!=='llm'||!Array.isArray(model.loaded_instances))continue;
   for(const instance of model.loaded_instances.slice(0,32))raw.push(instance?.id);
  }
 }
 const loadedModelIds=[],loadedRouteModelIds=[];
 for(const value of raw){
  const name=modelName(value);if(!name||loadedModelIds.includes(name))continue;
  loadedModelIds.push(name);
  // Display basenames cannot establish an exact routable alias for a path.
  if(name===value&&/^[A-Za-z0-9][A-Za-z0-9_.:@+-]{0,159}$/.test(value))loadedRouteModelIds.push(value);
  if(loadedModelIds.length===32)break;
 }
 return {loadedModelIds,loadedRouteModelIds};
}

function cancelBody(response){try{void response?.body?.cancel().catch(()=>{});}catch{}}
async function withAbort(operation,signal){
 signal.throwIfAborted();let abort;
 const aborted=new Promise((_,reject)=>{abort=()=>reject(signal.reason||failure('cancelled'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 try{return await Promise.race([operation,aborted]);}finally{signal.removeEventListener('abort',abort);}
}
async function boundedJson(response,signal,maxBytes){
 const type=(response.headers?.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(type!=='application/json')throw failure('unsupported_content_type');
 if(Number(response.headers?.get('content-length'))>maxBytes)throw failure('response_too_large');
 if(!response.body?.getReader)throw failure('missing_response_body');
 const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{
  for(;;){
   const chunk=await withAbort(reader.read(),signal);signal.throwIfAborted();
   if(chunk.done)break;
   size+=chunk.value.byteLength;if(size>maxBytes)throw failure('response_too_large');
   text+=decoder.decode(chunk.value,{stream:true});
  }
  text+=decoder.decode();
  let payload;try{payload=JSON.parse(text);}catch{throw failure('invalid_json');}
  if(!record(payload))throw failure('invalid_inventory');return payload;
 }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function getJson(url,{request,signal,maxBytes}){
 let response;
 // Race the fetch itself as well as its body: injected adapters may ignore abort.
 const pending=Promise.resolve().then(()=>{signal.throwIfAborted();return request(url,{method:'GET',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/json'},signal});});
 void pending.then(value=>{if(signal.aborted)cancelBody(value);},()=>{});
 try{
  response=await withAbort(pending,signal);signal.throwIfAborted();
  if(response.redirected||response.type==='opaqueredirect'||response.status>=300&&response.status<400)throw failure('redirect_forbidden');
  if(!response.ok)throw failure(response.status===401||response.status===403?'authentication_required':response.status===503?'not_ready':'http_error');
  return await boundedJson(response,signal,maxBytes);
 }finally{cancelBody(response);}
}

/** Seven anonymous GETs to fixed loopback endpoints; no configurable URL or key. */
export async function probeLocalRuntimes(options={}){
 optionsOnly(options,['request','signal','timeoutMs','maxBytes','now']);
 const {request=globalThis.fetch,signal,now=Date.now}=options;
 if(typeof request!=='function'||typeof now!=='function')throw new TypeError('El inventario necesita fetch y reloj.');
 const timeoutMs=bounded(options.timeoutMs,1500,25,5000),maxBytes=bounded(options.maxBytes,65536,128,131072);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(failure('timeout')),timeoutMs);
 const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
 const reason=error=>signal?.aborted?'cancelled':controller.signal.aborted?'timeout':['authentication_required','not_ready','http_error','redirect_forbidden','unsupported_content_type','response_too_large','missing_response_body','invalid_json','invalid_inventory'].includes(error?.code)?error.code:'unavailable';
 try{
  const runtimes=await Promise.all(LOCAL_RUNTIME_OPTIONS.map(async runtime=>{
   const base={id:runtime.id,label:runtime.label,url:runtime.url,endpointAvailable:false,endpointCompatible:false,runtimeIdentityVerified:false,inventoryAvailable:false,requiresAuthentication:false,models:[],loadedInventoryAvailable:false,loadedModelIds:[],loadedRouteModelIds:[],inferenceVerified:false};
   // Health is separate: the running Atlas server may protect /v1/models.
   const health=runtime.id==='llama.cpp'?getJson(runtime.url+'/health',{request,signal:combined,maxBytes}).then(value=>value.status==='ok'?'ready':'not_ready').catch(reason):Promise.resolve(null);
   const loadedPath=runtime.id==='ollama'?'/api/ps':runtime.id==='lm-studio'?'/api/v1/models':null;
   const loaded=loadedPath?getJson(runtime.url+loadedPath,{request,signal:combined,maxBytes}).then(payload=>({loadedInventoryAvailable:true,...loadedFrom(payload,runtime.id)})).catch(error=>({loadedInventoryAvailable:false,loadedModelIds:[],loadedRouteModelIds:[],loadedInventoryReason:reason(error)})):Promise.resolve(null);
   let result;
   try{const payload=await getJson(runtime.url+runtime.inventoryPath,{request,signal:combined,maxBytes}),models=modelsFrom(payload,runtime.id);result={...base,endpointAvailable:true,endpointCompatible:true,inventoryAvailable:true,models,...(runtime.id==='llama.cpp'?{loadedInventoryAvailable:true,...loadedFrom(payload,runtime.id)}:{}),reason:'inventory'};}
   catch(error){const code=reason(error);result={...base,endpointAvailable:['authentication_required','not_ready','http_error','unsupported_content_type','invalid_json','invalid_inventory','response_too_large','missing_response_body'].includes(code),requiresAuthentication:code==='authentication_required',reason:code};}
   const healthResult=await health;
   const loadedResult=await loaded;if(loadedResult)result={...result,...loadedResult};
   return healthResult===null?result:{...result,endpointAvailable:result.endpointAvailable||healthResult==='ready',endpointCompatible:result.endpointCompatible||healthResult==='ready',health:healthResult};
  }));
  return {checkedAt:new Date(now()).toISOString(),readOnly:true,inferenceVerified:false,runtimes};
 }finally{clearTimeout(timer);}
}

async function readBoundedText(file,maxBytes){
 const handle=await fs.open(file,'r');
 try{const buffer=Buffer.alloc(maxBytes+1),{bytesRead}=await handle.read(buffer,0,buffer.length,0);if(bytesRead>maxBytes)throw failure('file_too_large');return buffer.subarray(0,bytesRead).toString('utf8');}
 finally{await handle.close();}
}

/** Reads two small metadata files, then stats two GGUFs without reading weights.
 * Names and sizes are safe for status pages; private absolute paths stay local.
 */
export async function inspectConfiguredChatModels(root,options={}){
 optionsOnly(options,['readText','stat']);
 const {readText=readBoundedText,stat=fs.stat}=options;
 if(typeof root!=='string'||!root||typeof readText!=='function'||typeof stat!=='function')throw new TypeError('Carpeta canónica de inventario no válida.');
 let configured={},configuration='defaults',activeModelReported=null;
 try{const text=await readText(path.join(root,'data','chat-model-paths.json'),8192);if(typeof text!=='string'||Buffer.byteLength(text)>8192)throw failure('file_too_large');const parsed=JSON.parse(text);if(!record(parsed))throw failure('invalid_inventory');configured=parsed;configuration='configured';}
 catch(error){if(error?.code!=='ENOENT')configuration='unavailable';}
 try{const text=await readText(path.join(root,'data','active-chat-model.txt'),512);if(typeof text==='string'&&Buffer.byteLength(text)<=512)activeModelReported=modelName(text.trim());}catch{}
 const defaults={primary:path.join(root,'..','models','Qwen3.5-9B-Q4_K_M.gguf'),fallback:path.join(root,'..','models','Qwen3-4B-Instruct-2507-Q4_K_M.gguf')};
 const weightFiles=await Promise.all(['primary','fallback'].map(async slot=>{
  const file=configured[slot]||defaults[slot];
  if(typeof file!=='string'||file.length>4096||!file.toLowerCase().endsWith('.gguf')||!modelName(file))return {slot,modelName:null,exists:false,reason:'invalid_configuration'};
  const model=modelName(file);
  try{const value=await stat(path.isAbsolute(file)?file:path.resolve(root,file));return value.isFile()?{slot,modelName:model,exists:true,sizeBytes:bytes(value.size),reason:'file_present'}:{slot,modelName:model,exists:false,reason:'not_a_file'};}
  catch(error){return {slot,modelName:model,exists:false,reason:error?.code==='ENOENT'?'missing':'unavailable'};}
 }));
 return {readOnly:true,configuration,activeModelReported,activeModelVerified:false,weightIntegrityVerified:false,weightFiles};
}

/** Presence at a small list of known install paths; absence is not a full scan. */
export async function inspectLocalRuntimeInstallations(root,options={}){
 optionsOnly(options,['stat','homeDir','localAppData']);
 const {stat=fs.stat,homeDir=os.homedir(),localAppData=process.env.LOCALAPPDATA||path.join(homeDir,'AppData','Local')}=options;
 if(typeof root!=='string'||!root||typeof stat!=='function'||typeof homeDir!=='string'||typeof localAppData!=='string')throw new TypeError('Rutas de inventario no válidas.');
 const known={
  'llama.cpp':[path.join(root,'..','llama','llama-server.exe')],
  ollama:[path.join(root,'..','ollama','ollama.exe'),path.join(localAppData,'Programs','Ollama','ollama.exe')],
  'lm-studio':[path.join(localAppData,'Programs','LM Studio','LM Studio.exe'),path.join(homeDir,'.lmstudio','bin','lms.exe')],
  localai:[path.join(localAppData,'Programs','LocalAI','local-ai.exe')],
 };
 return Promise.all(LOCAL_RUNTIME_OPTIONS.map(async runtime=>{
  let found=false,unavailable=false;
  for(const file of known[runtime.id])try{if((await stat(file)).isFile())found=true;}catch(error){if(error?.code!=='ENOENT')unavailable=true;}
  return {id:runtime.id,installationFound:found,installationScope:'known-paths-only',reason:found?'file_present':unavailable?'unavailable':'not_found_at_known_paths'};
 }));
}
