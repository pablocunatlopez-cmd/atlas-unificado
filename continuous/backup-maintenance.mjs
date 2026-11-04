const DAY=24*60*60*1000;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const date=(value,now)=>{const at=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(at)&&at<=now?at:null;};
const failureCode=error=>error?.code==='ENOENT'?'source-missing':error?.code==='EACCES'||error?.code==='EPERM'?'source-access-denied':'backup-failed';

/** Independent maintenance, never a continuation of an external lookup.
 * Callers supply fixed local sources and private persistence. No files are
 * deleted, and only verified backups advance the last-success timestamp.
 */
export function createBackupMaintenance({jobs,readState,writeState,backup,sourceExists=async()=>true,now=Date.now,intervalMs=DAY,retryMs=30*60*1000}={}){
 if(!Array.isArray(jobs)||jobs.length<1||jobs.length>8||![readState,writeState,backup,sourceExists,now].every(fn=>typeof fn==='function')||!Number.isSafeInteger(intervalMs)||intervalMs<60000||intervalMs>7*DAY||!Number.isSafeInteger(retryMs)||retryMs<1000||retryMs>DAY)throw new TypeError('Configuración de respaldo no válida.');
 const known=new Set();
 const sources=jobs.map(job=>{
  if(!record(job)||Object.keys(job).some(key=>!['id','sourcePath','outputDir'].includes(key))||typeof job.id!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(job.id)||known.has(job.id)||![job.sourcePath,job.outputDir].every(value=>typeof value==='string'&&value.length>0&&value.length<2000))throw new TypeError('Origen de respaldo no válido.');
  known.add(job.id);return Object.freeze({...job});
 });
 let flight=null;
 function clock(){const value=now();if(!Number.isFinite(value)||!Number.isFinite(new Date(value).getTime()))throw new TypeError('Reloj de respaldo no válido.');return value;}
 async function run({signal}={}){
  const reports=[];
  for(const job of sources){
   signal?.throwIfAborted();
   let previous,attempted=null;
   try{
    const state=await readState(job.id);previous=record(state)?structuredClone(state):{};
    const time=clock(),lastSuccess=date(previous.at,time),lastAttempt=date(previous.lastAttempt,time);
    if(lastSuccess!==null&&time-lastSuccess<intervalMs){reports.push({id:job.id,status:'current',lastSuccess:previous.at});continue;}
    if(lastAttempt!==null&&time-lastAttempt<retryMs){reports.push({id:job.id,status:'deferred',retryAt:new Date(lastAttempt+retryMs).toISOString()});continue;}
    signal?.throwIfAborted();
    attempted={...previous,lastAttempt:new Date(time).toISOString()};
    // Persist intention first. If this fails, no snapshot is started.
    await writeState(job.id,attempted);
    if(!await sourceExists(job.sourcePath)){const error=new Error('Source missing');error.code='ENOENT';throw error;}
    signal?.throwIfAborted();
    const proof=await backup({sourcePath:job.sourcePath,outputDir:job.outputDir});
    if(!record(proof)||proof.status!=='verified'||proof.integrity!=='ok'||typeof proof.sha256!=='string'||!/^[a-f0-9]{64}$/.test(proof.sha256)||!Number.isSafeInteger(proof.bytes)||proof.bytes<1)throw new Error('Backup proof missing');
    // A completed snapshot is recorded even if cancellation arrived during the
    // non-cancellable SQLite Online Backup operation. No further job is started.
    const verified={...previous,...proof,lastAttempt:attempted.lastAttempt,at:new Date(clock()).toISOString(),lastError:null};
    await writeState(job.id,verified);
    reports.push({id:job.id,status:'verified',at:verified.at,bytes:proof.bytes,sha256:proof.sha256});
   }catch(error){
    if(signal?.aborted)throw signal.reason;
    const code=failureCode(error),at=new Date(clock()).toISOString();
    if(attempted){
     try{await writeState(job.id,{...previous,lastAttempt:attempted.lastAttempt,lastError:{code,at}});}
     catch{reports.push({id:job.id,status:'state-unavailable'});continue;}
    }
    reports.push({id:job.id,status:attempted?'failed':'state-unavailable',code,retryAt:attempted?new Date(Date.parse(attempted.lastAttempt)+retryMs).toISOString():null});
   }
  }
  return {at:new Date(clock()).toISOString(),jobs:reports};
 }
 // Only one run owns a source at a time. A second caller joins the owner run;
 // its cancellation cannot abort a backup another caller already started.
 function tick(options={}){options.signal?.throwIfAborted();if(flight)return flight;flight=run(options).finally(()=>{flight=null;});return flight;}
 return Object.freeze({tick});
}
