// Outbound-only worker: the public Site never gets access to the PC's network.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {planCreativeWorld} from './creative-plan.mjs';
import {sanitizeProcessTelemetry} from './process-telemetry.mjs';
import {readSessionLiveWork} from './session-live-work-gate.mjs';
import {publishEvidence} from './evidence-publish.mjs';
import {publishReportEvidence} from './publish-report-evidence.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),DATA=path.join(ROOT,'data');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const VIDEO_ID=/^video-\d{13}-[a-f0-9]{8}$/;
const CLOUD_JOB_ID=/^job-[a-f0-9]{64}$/;
const STAGES=new Set(['architect','critic','repair','revision','video','sampling','encoding','restoring','queued']);
const boundedBytes=value=>Number.isFinite(value)&&value>0?Math.min(100_000_000_000,Math.floor(value)):0;
export function publicBridgeCapabilities(input){
 const status=input?.status&&typeof input.status==='object'?input.status:input;
 const models=Array.isArray(status?.models)?status.models.slice(0,20):[];
 return {worlds:true,localRoles:['Arquitecto Qwen','Revisor Qwen'],independentModels:0,
  video:{ready:status?.ready===true,openfieldInstalled:status?.openfield?.sourceInstalled===true,nativeOpenfieldReady:status?.openfield?.nativeVideoReady===true,provider:'wan21-comfy',downloadedBytes:boundedBytes(models.reduce((sum,item)=>sum+boundedBytes(item?.downloadedBytes),0)),totalBytes:boundedBytes(models.reduce((sum,item)=>sum+boundedBytes(item?.expectedBytes),0))},
  gpuMode:input?.gpuMode==='training'?'training':input?.busy===true||input?.gpuMode==='video'?'video':'chat',processTelemetry:sanitizeProcessTelemetry(input?.processTelemetry)};
}
export function createCloudBridge({siteUrl,token,request=fetch,onState=()=>{},localBase='http://127.0.0.1:8788',sleep=pause,signal,heartbeatMs=12000,enforceSessionLiveWork=false}={}){
 const site=new URL(siteUrl);
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/')throw Error('La dirección de nube debe ser un origen HTTPS.');
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{32,200}$/.test(token))throw Error('Clave de puente inválida.');
 const local=new URL(localBase);
 if(local.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(local.hostname)||local.username||local.password||local.search||local.hash||local.pathname!=='/')throw Error('El coordinador debe estar en un origen de bucle local.');
 localBase=local.origin;
 const endpoint=site.origin+'/api/cloud/bridge';let active=false;let lastPublishedEvidenceAt=null;
 const emit=value=>onState({at:new Date().toISOString(),...value});
 const combined=(timeout,extra)=>AbortSignal.any([AbortSignal.timeout(timeout),...(signal?[signal]:[]),...(extra?[extra]:[])]);
 async function cloud(action,values={}){
  const response=await request(endpoint,{method:'POST',redirect:'error',signal:combined(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,agentId:'atlas-pc',...values})});
  if(!response.ok)throw Error('Nube no disponible (HTTP '+response.status+').');return response.json();
 }
 async function localReady(){
  const response=await request(localBase+'/chat/health',{redirect:'error',signal:combined(4000)});if(!response.ok)return null;
  const health=await response.json();return health.ready?health:null;
 }
 async function capabilities(){
  try{const [response,telemetry]=await Promise.allSettled([request(localBase+'/media/status',{redirect:'error',signal:combined(4000)}),request(localBase+'/process/status',{redirect:'error',signal:combined(4000)})]);const media=response.status==='fulfilled'&&response.value.ok?await response.value.json():{};const processes=telemetry.status==='fulfilled'&&telemetry.value.ok?await telemetry.value.json():null;return publicBridgeCapabilities({...media,processTelemetry:processes});}catch{return publicBridgeCapabilities(null);}
 }
 async function localToken(jobSignal){
  const page=await request(localBase+'/chat/',{redirect:'error',signal:jobSignal});
  const value=/name="atlas-token" content="([a-f0-9]+)"/.exec(await page.text())?.[1];
  if(!page.ok||!value)throw Error('No se pudo autenticar el coordinador local.');return value;
 }
 async function localPost(route,body,jobSignal){
  const maxBusyRetries=8;
  for(let attempt=0;attempt<=maxBusyRetries;attempt++){
   jobSignal.throwIfAborted();const value=await localToken(jobSignal);
   const response=await request(localBase+route,{method:'POST',redirect:'error',signal:jobSignal,headers:{'Content-Type':'application/json','X-Atlas-Token':value,Origin:localBase},body:JSON.stringify(body)});
   if(response.status!==429)return response;
   if(attempt===maxBusyRetries)throw Error('El coordinador local sigue ocupado tras varios intentos.');
   await sleep(3000);
   jobSignal.throwIfAborted();
  }
 }
 async function chat(messages,jobSignal,{json=false,internet=false,creativeMode=null}={}){
  const response=await localPost('/chat/message',{messages,sharedSession:true,internet:internet===true,tools:false,external:false,...(json?{json:true}:{}),...(['world','game'].includes(creativeMode)?{creativeMode}:{})},jobSignal);
  const result=await response.json();
  if(!response.ok||typeof result.answer!=='string'||!result.answer.trim()||result.answer.length>16000||!['atlas-local','atlas-coordinator'].includes(result.model))throw Error('Respuesta local inválida.');
  return {answer:result.answer,model:result.model,modelName:typeof result.modelName==='string'?result.modelName.slice(0,160):'Qwen local'};
 }
 async function video(job,jobSignal,onProgress){
  if(!CLOUD_JOB_ID.test(job.id))throw Error('Identificador de vídeo de nube inválido.');
  const prompt=typeof job.question==='string'?job.question:[...job.messages].reverse().find(message=>message.role==='user')?.content;
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw Error('Petición de vídeo inválida.');
  const supplied=job.parameters&&typeof job.parameters==='object'?job.parameters:{};
  const parameters={frames:[17,33,49,65,81].includes(supplied.frames)?supplied.frames:17,width:480,height:272,steps:Number.isInteger(supplied.steps)&&supplied.steps>=5&&supplied.steps<=30?supplied.steps:5,fps:8};
  const response=await localPost('/media/generate',{prompt,parameters},jobSignal);
  if(!response.ok||!response.body?.getReader)throw Error('El motor de vídeo no respondió.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',seen=0,result=null;
  const consume=line=>{
   if(!line.trim())return;const event=JSON.parse(line);
   if(event.type==='error')throw Error('El motor local no pudo crear el vídeo.');
   if(event.type==='progress')onProgress(event);
   if(event.type==='result')result=event.result&&typeof event.result==='object'?event.result:event;
  };
  try{
   for(;;){jobSignal.throwIfAborted();const item=await reader.read();if(item.done)break;seen+=item.value.byteLength;if(seen>1024*1024)throw Error('Demasiados eventos de vídeo.');pending+=decoder.decode(item.value,{stream:true});if(pending.length>256000)throw Error('Evento de vídeo demasiado grande.');let end;while((end=pending.indexOf('\n'))>=0){consume(pending.slice(0,end));pending=pending.slice(end+1);}}
   pending+=decoder.decode();if(pending.trim())consume(pending);
  }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  jobSignal.throwIfAborted();
  if(!result||!VIDEO_ID.test(result.id)||result.provider!=='wan21-comfy')throw Error('El motor no acreditó un archivo de vídeo válido.');
  const artifact=await request(localBase+'/media/artifact?id='+encodeURIComponent(result.id),{redirect:'error',signal:jobSignal});
  const length=Number(artifact.headers?.get('content-length'));
  if(!artifact.ok||length>10*1024*1024)throw Error('El archivo de vídeo no está disponible.');
  // Enforce the size cap while streaming: Content-Length may be absent or false.
  const maxArtifactBytes=10*1024*1024;
  if(!artifact.body?.getReader)throw Error('El vídeo no permite lectura controlada.');
  const artifactReader=artifact.body.getReader(),chunks=[];let total=0;
  try{
   for(;;){
    jobSignal.throwIfAborted();
    const {done,value}=await artifactReader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>maxArtifactBytes)throw Error('El archivo de vídeo supera el límite permitido.');
    chunks.push(value);
   }
  }catch(error){await artifactReader.cancel().catch(()=>{});throw error;}
  finally{artifactReader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(bytes.length<32||String.fromCharCode(...bytes.subarray(4,8))!=='ftyp')throw Error('El resultado no es un MP4 permitido.');
  const uploaded=await request(site.origin+'/api/cloud/artifacts/'+job.id,{method:'POST',redirect:'error',signal:combined(120000,jobSignal),headers:{Authorization:'Bearer '+token,'X-Atlas-Lease':job.leaseToken,'Content-Type':'video/mp4','Content-Length':String(bytes.length)},body:bytes});
  if(!uploaded.ok)throw Error('No se pudo guardar el vídeo en la nube.');
  return {answer:'He generado un clip de vídeo local. Puedes abrirlo y descargarlo desde tu biblioteca privada.',model:'atlas-coordinator',modelName:'Wan2.1 · GPU local',video:{artifactId:job.id,provider:'wan21-comfy'}};
 }
 async function tick(){
  if(active)return {status:'busy'};active=true;
  try{
   signal?.throwIfAborted();const health=await localReady();if(!health){const snapshot=await capabilities();if(['video','training'].includes(snapshot.gpuMode)){const state=await cloud('heartbeat',{modelName:'Qwen · GPU reservada',capabilities:snapshot});if(snapshot.gpuMode==='training'&&state.queuedCount>0)await localPost('/evolution/yield',{},combined(10000));emit({status:'gpu_reserved',mode:snapshot.gpuMode});return {status:'busy'};}emit({status:'waiting_for_local_model'});return {status:'offline'};}
   const modelName=health.modelName||'Qwen local';let publicCapabilities=await capabilities();
   const sessionLiveWork=await readSessionLiveWork(siteUrl,{request,signal:combined(8000)});
   try{
    const autonomy=JSON.parse(await fs.readFile(path.join(DATA,'autonomous-review.json'),'utf8'));
    const report=autonomy.history?.at(-1);
    const reportAt=typeof report?.at==='string'?report.at:null;
    if(report&&reportAt&&reportAt!==lastPublishedEvidenceAt&&(report.typedEvidence?.length||report.candidate||report.checks)){
     const published=await publishReportEvidence(report,{request,signal:combined(10000)});
     if(published.ok||published.saved){lastPublishedEvidenceAt=reportAt;emit({status:'online',modelName,sessionLiveWork,typedEvidence:published});}
    }
   }catch{/* no autonomy history yet */}
   emit({status:'online',modelName,sessionLiveWork});
   const {job}=await cloud('claim',{modelName,capabilities:publicCapabilities});
   if(!job){emit({status:'online',modelName,sessionLiveWork});return {status:'idle'};}
   if(typeof job.id!=='string'||typeof job.leaseToken!=='string'||!Array.isArray(job.messages))throw Error('Trabajo de nube inválido.');
   emit({status:'answering',jobId:job.id,modelName,sessionLiveWork});
   const kind=job.kind??'chat';if(!['chat','world','game','video','lor','review'].includes(kind))throw Error('Tipo de trabajo no disponible.');
   if(kind==='review'&&enforceSessionLiveWork&&!sessionLiveWork.mayStartLiveWork){
    emit({status:'online',modelName,sessionLiveWork,skippedReview:true,reason:sessionLiveWork.reason});
    await cloud('fail',{jobId:job.id,leaseToken:job.leaseToken,error:'Revisión en vivo no autorizada: hace falta ciclo activo y opt-in de sesión visible ('+sessionLiveWork.reason+').'});
    return {status:'skipped_review',reason:sessionLiveWork.reason};
   }
   const abort=new AbortController(),jobSignal=combined(kind==='video'?1800000:450000,abort.signal);
   let stage=kind==='video'?'video':kind==='chat'?null:'architect',progress=0,finished=false;
   const onProgress=event=>{if(STAGES.has(event.stage))stage=event.stage;const value=event.progress??(typeof event.value==='number'?event.value*100:undefined);if(Number.isFinite(value))progress=Math.max(progress,Math.min(99,Math.max(0,Math.round(value))));};
   let checking=false;const heartbeat=setInterval(async()=>{
    if(checking)return;checking=true;
    try{publicCapabilities=await capabilities();const result=await cloud('heartbeat',{jobId:job.id,leaseToken:job.leaseToken,modelName,capabilities:publicCapabilities,...(stage?{stage,progress}:{})});if(!finished&&result.continue===false)abort.abort(Error('Solicitud cancelada en la nube'));}
    catch{emit({status:'reconnecting',jobId:job.id});}finally{checking=false;}
   },heartbeatMs);
   try{
    let safeResult;
    if(kind==='world'||kind==='game'){
     const prompt=typeof job.question==='string'?job.question:[...job.messages].reverse().find(message=>message.role==='user')?.content;
     const creative=await planCreativeWorld(prompt,kind==='game'?'game':'3d',async text=>(await chat([{role:'user',content:text}],jobSignal,{json:true,creativeMode:kind})).answer,{signal:jobSignal,onStage:event=>onProgress({...event,progress:({architect:10,repair:25,critic:65,revision:80})[event.stage]})});
     safeResult={answer:'He diseñado y validado el plan de un '+(kind==='game'?'prototipo de juego':'entorno 3D')+'.',model:'atlas-local',modelName,creative};
    }else if(kind==='review'){
     onProgress({stage:'critic',progress:25});
     const response=await localPost('/autonomy/run',{},jobSignal),review=await response.json();
     if(!response.ok||review.queued!==true)throw Error('El coordinador no pudo encolar la revisión.');
     const current=await request(localBase+'/process/status',{redirect:'error',signal:jobSignal});
     const experience=current.ok?sanitizeProcessTelemetry(await current.json())?.experience:null;
     if(review.evidence){
      try{
       const published=await publishEvidence(siteUrl,token,review.evidence,{request,signal:jobSignal});
       if(published.ok)emit({status:'evidence_published',jobId:job.id,accepted:published.body?.accepted??1});
      }catch{/* evidence publish must not fail the user-facing review acknowledgement */}
     }
     safeResult={answer:'He pedido al coordinador una revisión real de mi programa. Atlas elige la siguiente pregunta y trabaja con los ejecutores disponibles. '+(experience?`El registro comunica ${experience.experiences} experiencias y ${experience.learningChanges} ${experience.learningChanges===1?'cambio aceptado':'cambios aceptados'}. `:'')+'[Ver actividad de Atlas](/actividad/). Poner una revisión en marcha no significa que ya haya mejorado ni que se hayan cambiado los pesos de Qwen.',model:'atlas-coordinator',modelName:'Atlas · revisión autónoma'};
    }else if(kind==='lor'){
     onProgress({stage:'critic',progress:25});const response=await localPost('/lor/experiment',{},jobSignal),lor=await response.json();if(!response.ok||lor.synthetic!==true||typeof lor.verdict!=='string')throw Error('El experimento LOR no produjo evidencia válida.');
     const safeLor=sanitizeProcessTelemetry({lor})?.lor;if(!safeLor||![safeLor.baseline,safeLor.score,safeLor.delta,safeLor.negativeControlDelta].every(Number.isFinite))throw Error('El experimento LOR no devolvió medidas finitas.');
     safeResult={answer:'Experimento LOR-ΩΣ ejecutado en CPU.',model:'atlas-coordinator',modelName:'LOR-ΩΣ · CPU local',lor:safeLor};
    }else if(kind==='video'){
     safeResult=await video(job,jobSignal,onProgress);
    }else{
     safeResult=await chat(job.messages,jobSignal,{internet:job.internet===true});
    }
    jobSignal.throwIfAborted();
    await cloud('complete',{jobId:job.id,leaseToken:job.leaseToken,result:safeResult});
    finished=true;
    emit({status:'online',modelName,lastCompletedJob:job.id,sessionLiveWork});return {status:'completed',jobId:job.id};
   }catch(error){
    if(!signal?.aborted)await cloud('fail',{jobId:job.id,leaseToken:job.leaseToken,error:abort.signal.aborted?'Solicitud cancelada.':'El motor del PC no pudo completar esta respuesta. Puedes volver a intentarlo.'}).catch(()=>{});
    const detail=String(error?.message||'Fallo local').replace(/\bsk-[A-Za-z0-9_-]+\b|Bearer\s+\S+/gi,'[credencial oculta]').slice(0,1000);
    emit({status:'job_failed',jobId:job.id,kind,stage,error:detail,sessionLiveWork});return {status:'failed',jobId:job.id};
   }finally{clearInterval(heartbeat);}
  }finally{active=false;}
 }
 return {tick};
}

async function main(){
 const config=JSON.parse(await fs.readFile(path.join(DATA,'cloud-bridge.json'),'utf8'));
 const token=(await fs.readFile(path.join(DATA,'cloud-bridge.key'),'utf8')).trim();
 const lockPath=path.join(DATA,'cloud-bridge.pid');let lock;
 try{lock=await fs.open(lockPath,'wx');}catch(error){
  if(error.code!=='EEXIST')throw error;
  const pid=Number(await fs.readFile(lockPath,'utf8'));let alive=true;
  try{process.kill(pid,0);}catch(problem){if(problem.code==='ESRCH')alive=false;}
  if(alive)return;await fs.rm(lockPath,{force:true});lock=await fs.open(lockPath,'wx');
 }
 await lock.writeFile(String(process.pid));
 const controller=new AbortController();for(const name of ['SIGINT','SIGTERM'])process.on(name,()=>controller.abort());
 let writes=Promise.resolve();
 const enforceSessionLiveWork=process.env.ATLAS_ENFORCE_SESSION_LIVE_WORK==='1'||process.env.ATLAS_ENFORCE_SESSION_LIVE_WORK==='true';
 const worker=createCloudBridge({siteUrl:config.siteUrl,token,signal:controller.signal,enforceSessionLiveWork,onState:state=>{writes=writes.then(()=>fs.writeFile(path.join(DATA,'cloud-bridge-status.json'),JSON.stringify(state,null,2))).catch(()=>{});}});
 try{
  while(!controller.signal.aborted){
   try{await fs.access(path.join(DATA,'service.stop'));break;}catch{}
   try{const result=await worker.tick();await pause(result.status==='completed'?500:5000);}catch{await pause(15000);}
  }
 }finally{await writes;await lock.close();await fs.rm(lockPath,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('No se pudo iniciar el puente de nube. Comprueba su configuración local.');process.exitCode=1;});
