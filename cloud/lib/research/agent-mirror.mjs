const MIN_TTL=30*60*1000,MAX_TIMEOUT=12000,MAX_BYTES=65536;
const SCOPE='Metadatos públicos de repositorios oficiales. Referencias para investigar; no clasificación de calidad, instalación, ejecución ni acceso gratuito a modelos.';
const MODELS={claude:{connected:false,sdkIsModelAccess:false,requiresOwnAuthentication:true}};
const DEFINITIONS=[
 ['aider','Aider-AI/aider','coding-agent','Estudiar edición por contexto y contratos antes de integrar otro adaptador.'],
 ['smolagents','huggingface/smolagents','coding-agent','Estudiar herramientas y ejecución aislada compatibles con el modelo local.'],
 ['openhands','OpenHands/OpenHands','agent-framework','Revisar arquitectura, requisitos y aislamiento antes de proponer una integración.'],
 ['goose','aaif-goose/goose','agent-framework','Revisar extensibilidad, adaptadores y sus requisitos antes de ejecutar código.'],
 ['claude-sdk','anthropics/claude-agent-sdk-python','claude-sdk-reference','Un SDK no proporciona acceso a Claude: estudiar interfaces sin afirmar conexión al modelo.'],
 ['claude-skills','anthropics/skills','skills-reference','Estudiar convenciones de habilidades y licencia; un repositorio no transfiere herramientas ni modelos de Codex.'],
].map(([id,repository,reason,guidance])=>Object.freeze({id,repository,url:'https://github.com/'+repository,api:'https://api.github.com/repos/'+repository,reason,guidance}));
const ERRORS=new Set(['rate-limited','timeout','network-unavailable','http-error','invalid-metadata','repository-unavailable']);
const copy=value=>JSON.parse(JSON.stringify(value));
const abortError=()=>new DOMException('The request was cancelled.','AbortError');
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const clock=now=>{const n=now();if(!Number.isFinite(n)||!Number.isFinite(new Date(n).getTime()))throw Error('Invalid clock');return n;};
const iso=n=>new Date(n).toISOString();
function identity(value,expected){
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname.replace(/\/$/,'').toLowerCase()==='/'+expected.repository.toLowerCase();}catch{return false;}
}
function license(value,definition){
 const id=value?.spdx_id;if(typeof id!=='string'||id==='NOASSERTION'||! /^[A-Za-z0-9][A-Za-z0-9.+-]{0,79}$/.test(id))return null;
 return {spdxId:id,sourceUrl:definition.api,verification:'github-rest-metadata'};
}
function metadata(value,definition,observedAt){
 if(!value||value.private!==false||value.archived!==false||value.disabled!==false||value.visibility!==undefined&&value.visibility!=='public')return null;
 const updatedAt=stamp(value.updated_at);
 if(typeof value.full_name!=='string'||value.full_name.toLowerCase()!==definition.repository.toLowerCase()||!identity(value.html_url,definition)||!updatedAt||Date.parse(updatedAt)>Date.parse(observedAt)+300000)return null;
 return {id:definition.id,repository:definition.repository,url:definition.url,reason:definition.reason,guidance:definition.guidance,updatedAt,observedAt,license:license(value.license,definition),installationVerified:false,executionVerified:false};
}

/** Reconstruct a closed public snapshot; never trusts descriptions or claims. */
export function sanitizeAgentMirror(value){
 if(value?.version!==1||value.source!=='github-rest-public'||!stamp(value.observedAt)||!stamp(value.expiresAt)||!Array.isArray(value.items)||value.items.length>6||!Array.isArray(value.errors)||value.errors.length>6)return null;
 const seen=new Set(),items=[],errors=[];
 for(const item of value.items){
  const d=DEFINITIONS.find(d=>d.id===item?.id&&d.repository===item.repository);
  if(!d||seen.has(d.id)||!identity(item.url,d)||!stamp(item.updatedAt)||!stamp(item.observedAt))return null;
  seen.add(d.id);
  const l=item.license,checked=l&&l.sourceUrl===d.api&&l.verification==='github-rest-metadata'?license({spdx_id:l.spdxId},d):null;
  items.push({id:d.id,repository:d.repository,url:d.url,reason:d.reason,guidance:d.guidance,updatedAt:stamp(item.updatedAt),observedAt:stamp(item.observedAt),license:checked,installationVerified:false,executionVerified:false});
 }
 for(const error of value.errors){const d=DEFINITIONS.find(d=>d.repository===error?.repository);if(!d||seen.has(d.id)||!ERRORS.has(error.reason)||!stamp(error.retryAt))return null;seen.add(d.id);errors.push({repository:d.repository,reason:error.reason,retryAt:stamp(error.retryAt)});}
 return {version:1,source:'github-rest-public',status:items.length===6?'ready':items.length?'partial':'unavailable',observedAt:stamp(value.observedAt),expiresAt:stamp(value.expiresAt),items,errors,externalModels:copy(MODELS),scope:SCOPE};
}

function abortable(promise,signal){
 if(signal.aborted)return Promise.reject(signal.reason||abortError());
 return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason||abortError());signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
}
async function readMetadata(response,signal){
 const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>MAX_BYTES)throw Error('Invalid metadata');
 if(!response.body)throw Error('Invalid metadata');
 const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
 try{while(true){const chunk=await abortable(reader.read(),signal);if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>MAX_BYTES)throw Error('Invalid metadata');text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}
 finally{reader.cancel().catch(()=>{});reader.releaseLock();}
}

/** One bounded public batch per cache window. No request runs on import.
 * Cancellation releases a waiter without cancelling another caller's batch.
 * If every waiter leaves, the batch is cancelled and is not negative-cached.
 */
export function createAgentMirror({fetch:request=(...args)=>globalThis.fetch(...args),now=Date.now,ttlMs=MIN_TTL,timeoutMs=MAX_TIMEOUT}={}){
 const ttl=Math.max(MIN_TTL,Math.min(24*3600000,Number(ttlMs)||MIN_TTL)),timeout=Math.max(1,Math.min(MAX_TIMEOUT,Number(timeoutMs)||MAX_TIMEOUT));
 let cached=null,flight=null;
 function start(){
  const controller=new AbortController(),state={controller,waiters:0,done:false,cancelled:false,promise:null};
  state.promise=(async()=>{
   const started=clock(now),observedAt=iso(started),fallbackRetry=started+ttl;
   let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort(abortError());},timeout);
   try{
    const results=await Promise.all(DEFINITIONS.map(async definition=>{
     let reason='network-unavailable',retryAt=fallbackRetry;
     try{
      const response=await abortable(Promise.resolve().then(()=>request(definition.api,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Atlas-Public-Research'}})),controller.signal);
      if(response.status===429||response.status===403&&response.headers.get('x-ratelimit-remaining')==='0'){
       reason='rate-limited';const raw=response.headers.get('retry-after'),seconds=raw&&/^\d+$/.test(raw)?Number(raw):null,until=seconds===null?Date.parse(raw||''):started+seconds*1000;
       if(Number.isFinite(until))retryAt=Math.max(fallbackRetry,Math.min(started+24*3600000,until));
      }else if(!response.ok)reason=response.status===404?'repository-unavailable':'http-error';
      else{
       reason='invalid-metadata';const item=metadata(await readMetadata(response,controller.signal),definition,observedAt);if(item)return {item};
      }
     }catch{if(timedOut)reason='timeout';}
     return {error:{repository:definition.repository,reason,retryAt:iso(retryAt)}};
    }));
    if(state.cancelled)throw abortError();
    const expires=Math.max(fallbackRetry,...results.map(r=>r.error?Date.parse(r.error.retryAt):fallbackRetry));
    const snapshot=sanitizeAgentMirror({version:1,source:'github-rest-public',observedAt,expiresAt:iso(expires),items:results.flatMap(r=>r.item?[r.item]:[]),errors:results.flatMap(r=>r.error?[r.error]:[])});
    cached=snapshot;return snapshot;
   }finally{clearTimeout(timer);state.done=true;if(flight===state)flight=null;}
  })();
  flight=state;return state;
 }
 return function get({signal}={}){
  if(signal?.aborted)return Promise.reject(signal.reason||abortError());
  if(cached&&Date.parse(cached.expiresAt)>clock(now))return Promise.resolve(copy(cached));
  const state=flight&&!flight.cancelled?flight:start();state.waiters++;
  return new Promise((resolve,reject)=>{
   let finished=false;
   const release=()=>{if(finished)return false;finished=true;state.waiters--;signal?.removeEventListener('abort',abort);return true;};
   const abort=()=>{if(!release())return;if(!state.done&&state.waiters===0){state.cancelled=true;state.controller.abort(abortError());}reject(signal.reason||abortError());};
   signal?.addEventListener('abort',abort,{once:true});
   state.promise.then(value=>{if(release())resolve(copy(value));},error=>{if(release())reject(error);});
  });
 };
}

const publicMirror=createAgentMirror();
export const getAgentMirror=options=>publicMirror(options);
