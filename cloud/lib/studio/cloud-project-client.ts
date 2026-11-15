import type {StudioProject} from './types.ts';

type Input={prompt:string;mode:'image'|'3d'|'game';requestId:string};
export type CloudStudioJob={id:string;status:string;progress?:number};
type Options={signal:AbortSignal;onJob?:(job:CloudStudioJob)=>void;fetcher?:typeof fetch;pollIntervalMs?:number;wait?:(ms:number,signal:AbortSignal)=>Promise<void>};
type ErrorCode='input'|'network'|'http'|'response'|'failed'|'cancelled';
export class CloudStudioProjectError extends Error{
 readonly code:ErrorCode;readonly status?:number;
 constructor(message:string,code:ErrorCode,status?:number){super(message);this.name='CloudStudioProjectError';this.code=code;this.status=status;}
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jobId=/^job-[a-f0-9]{64}$/;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const errorText=(value:unknown,fallback:string)=>typeof value==='string'&&value.trim()?value.trim().slice(0,500):fallback;
function active(signal:AbortSignal){if(signal.aborted)throw signal.reason??new DOMException('La creación se ha detenido.','AbortError');}
function pause(ms:number,signal:AbortSignal):Promise<void>{
 active(signal);
 return new Promise((resolve,reject)=>{
  const done=()=>{signal.removeEventListener('abort',abort);resolve();},timer=setTimeout(done,ms);
  const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason??new DOMException('La creación se ha detenido.','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
 });
}
function project(value:unknown,id:string,mode:Input['mode']):StudioProject{
 if(!record(value)||value.id!==id||typeof value.title!=='string'||typeof value.prompt!=='string'||typeof value.code!=='string'||!value.code.trim()||!record(value.brief)||!Array.isArray(value.versions)||!Number.isInteger(value.revision)||Number(value.revision)<1||!Number.isInteger(value.viewingVersion)||Number(value.viewingVersion)<1||Number(value.viewingVersion)>Number(value.revision)||typeof value.createdAt!=='string'||typeof value.updatedAt!=='string')throw new CloudStudioProjectError('Atlas no devolvió un proyecto completo. La versión anterior se conserva.','response');
 const accepted=mode==='image'?['image','3d']:[mode];
 if(typeof value.mode!=='string'||!accepted.includes(value.mode)||value.brief.mode!==value.mode||typeof value.brief.palette!=='string'||!['day','sunset','night'].includes(String(value.brief.lighting))||!['balanced','high'].includes(String(value.brief.quality))||!Number.isInteger(value.brief.seed)||!Array.isArray(value.brief.unsupported))throw new CloudStudioProjectError('El proyecto recibido no corresponde al tipo de creación solicitado.','response');
 return value as unknown as StudioProject;
}

/** Run one explicit cloud design request and open its persisted project. The
 * caller owns the overall deadline and any server-side cancellation action. */
export async function createCloudStudioProject(input:Input,{signal,onJob,fetcher=fetch,pollIntervalMs=1500,wait=pause}:Options):Promise<StudioProject>{
 active(signal);
 if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>4000||!['image','3d','game'].includes(input.mode)||typeof input.requestId!=='string'||!input.requestId.trim()||input.requestId.length>120||!Number.isFinite(pollIntervalMs)||pollIntervalMs<0||pollIntervalMs>60000)throw new CloudStudioProjectError('Describe una creación de entre 1 y 4.000 caracteres y elige un modo disponible.','input');
 async function json(url:string,init:RequestInit={}){
  active(signal);let response:Response;
  try{response=await fetcher(url,{...init,signal,cache:'no-store',credentials:'same-origin'});}catch{active(signal);throw new CloudStudioProjectError('No se pudo conectar con Atlas. Tu solicitud conserva su identificador para reintentarlo.','network');}
  active(signal);const value:unknown=await response.json().catch(()=>null);active(signal);
  if(!response.ok)throw new CloudStudioProjectError(errorText(record(value)?value.error:undefined,'Atlas no pudo completar esta operación.'),'http',response.status);
  if(!record(value))throw new CloudStudioProjectError('Atlas devolvió una respuesta que no se pudo interpretar.','response');
  return value;
 }
 const queued=await json('/api/cloud/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:input.prompt.trim(),kind:input.mode==='game'?'game':'world',requestId:input.requestId})});
 if(typeof queued.jobId!=='string'||!jobId.test(queued.jobId)||!['queued','running','completed','failed','cancelled'].includes(String(queued.status)))throw new CloudStudioProjectError('Atlas no devolvió una solicitud de creación válida.','response');
 const id=queued.jobId;onJob?.({id,status:String(queued.status)});
 while(true){
  const current=await json('/api/cloud/jobs/'+id);
  if(current.id!==id||!['queued','running','completed','failed','cancelled'].includes(String(current.status)))throw new CloudStudioProjectError('El estado recibido no corresponde a esta creación.','response');
  const status=String(current.status);onJob?.({id,status,...(typeof current.progress==='number'&&Number.isFinite(current.progress)&&current.progress>=0&&current.progress<=100?{progress:current.progress}:{})});
  if(status==='failed'||status==='cancelled')throw new CloudStudioProjectError(errorText(current.error,status==='cancelled'?'La creación se ha detenido. La versión anterior se conserva.':'Atlas no pudo completar el diseño. La versión anterior se conserva.'),status);
  if(status==='completed'){
   const result=record(current.result)?current.result:null,creative=result&&record(result.creative)?result.creative:null,id=creative?.projectId;
   if(typeof id!=='string'||!uuid.test(id))throw new CloudStudioProjectError('El diseño terminó sin un proyecto guardado válido.','response');
   const saved=await json('/api/studio?id='+encodeURIComponent(id));return project(saved.project,id,input.mode);
  }
  await wait(pollIntervalMs,signal);active(signal);
 }
}
