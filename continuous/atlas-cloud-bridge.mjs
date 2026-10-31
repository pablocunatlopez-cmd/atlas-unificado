// Outbound-only worker: the public Site never gets access to the PC's network.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),DATA=path.join(ROOT,'data');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function createCloudBridge({siteUrl,token,request=fetch,onState=()=>{},localBase='http://127.0.0.1:8788',sleep=pause,signal}={}){
 const site=new URL(siteUrl);
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/')throw Error('La dirección de nube debe ser un origen HTTPS.');
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{32,200}$/.test(token))throw Error('Clave de puente inválida.');
 const endpoint=site.origin+'/api/cloud/bridge';let active=false;
 const emit=value=>onState({at:new Date().toISOString(),...value});
 async function cloud(action,values={}){
  const response=await request(endpoint,{method:'POST',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,agentId:'atlas-pc',...values})});
  if(!response.ok)throw Error('Nube no disponible (HTTP '+response.status+').');return response.json();
 }
 async function localReady(){
  const response=await request(localBase+'/chat/health',{signal:AbortSignal.timeout(4000)});if(!response.ok)return null;
  const health=await response.json();return health.ready?health:null;
 }
 async function tick(){
  if(active)return {status:'busy'};active=true;
  try{
   signal?.throwIfAborted();const health=await localReady();if(!health){emit({status:'waiting_for_local_model'});return {status:'offline'};}
   const modelName=health.modelName||'Qwen local';const {job}=await cloud('claim',{modelName});
   if(!job){emit({status:'online',modelName});return {status:'idle'};}
   if(typeof job.id!=='string'||typeof job.leaseToken!=='string'||!Array.isArray(job.messages))throw Error('Trabajo de nube inválido.');
   emit({status:'answering',jobId:job.id,modelName});
   const abort=new AbortController(),jobSignal=AbortSignal.any([abort.signal,AbortSignal.timeout(450000),...(signal?[signal]:[])]);
   let checking=false;const heartbeat=setInterval(async()=>{
    if(checking)return;checking=true;
    try{const result=await cloud('heartbeat',{jobId:job.id,leaseToken:job.leaseToken,modelName});if(result.continue===false)abort.abort(Error('Solicitud cancelada en la nube'));}
    catch{emit({status:'reconnecting',jobId:job.id});}finally{checking=false;}
   },12000);
   try{
    let result;
    for(;;){
     jobSignal.throwIfAborted();
     const page=await request(localBase+'/chat/',{signal:jobSignal});const localToken=/name="atlas-token" content="([a-f0-9]+)"/.exec(await page.text())?.[1];if(!localToken)throw Error('No se pudo autenticar el coordinador local.');
     const response=await request(localBase+'/chat/message',{method:'POST',signal:jobSignal,headers:{'Content-Type':'application/json','X-Atlas-Token':localToken,Origin:localBase},body:JSON.stringify({messages:job.messages,sharedSession:true,internet:job.internet===true,tools:false,external:false})});
     if(response.status===429){await sleep(3000);continue;}
     result=await response.json();if(!response.ok)throw Error('El motor local no pudo completar la respuesta.');break;
    }
    if(typeof result.answer!=='string'||!result.answer.trim()||result.answer.length>16000||!['atlas-local','atlas-coordinator'].includes(result.model))throw Error('Respuesta local inválida.');
    const safeResult={answer:result.answer,model:result.model,modelName:result.modelName||modelName};
    await cloud('complete',{jobId:job.id,leaseToken:job.leaseToken,result:safeResult});
    emit({status:'online',modelName,lastCompletedJob:job.id});return {status:'completed',jobId:job.id};
   }catch(error){
    if(!signal?.aborted)await cloud('fail',{jobId:job.id,leaseToken:job.leaseToken,error:abort.signal.aborted?'Solicitud cancelada.':'El motor del PC no pudo completar esta respuesta. Puedes volver a intentarlo.'}).catch(()=>{});
    emit({status:'job_failed',jobId:job.id});return {status:'failed',jobId:job.id};
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
 const worker=createCloudBridge({siteUrl:config.siteUrl,token,signal:controller.signal,onState:state=>{writes=writes.then(()=>fs.writeFile(path.join(DATA,'cloud-bridge-status.json'),JSON.stringify(state,null,2))).catch(()=>{});}});
 try{
  while(!controller.signal.aborted){
   try{await fs.access(path.join(DATA,'service.stop'));break;}catch{}
   try{const result=await worker.tick();await pause(result.status==='completed'?500:5000);}catch{await pause(15000);}
  }
 }finally{await writes;await lock.close();await fs.rm(lockPath,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('No se pudo iniciar el puente de nube. Comprueba su configuración local.');process.exitCode=1;});
