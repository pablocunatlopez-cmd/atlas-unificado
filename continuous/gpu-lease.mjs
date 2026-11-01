import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// A live service-owned lease tells the watchdog that Qwen is intentionally unloaded.
export function createGpuLease({directory,pid=process.pid,now=Date.now,suspend,release,restore,shouldRestore=()=>true,intervalMs=5000}={}){
 const file=path.join(directory,'gpu-lease.json');let busy=false;
 const read=async()=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 async function run(task,{signal,onStage=()=>{},role='video'}={}){
  if(!['video','training'].includes(role))throw Error('Tipo de reserva GPU no admitido.');
  if(busy)throw Error('La GPU ya está reservada para vídeo.');busy=true;
  const nonce=randomUUID();let timer,renewal=Promise.resolve(),published=false;
  const renew=async()=>{const current=await read();if(published&&current?.nonce!==nonce)throw Error('La reserva de GPU cambió de propietario.');const record={role,ownerPid:pid,nonce,expiresAt:now()+45000};await fs.writeFile(file+'.tmp',JSON.stringify(record));await fs.rename(file+'.tmp',file);published=true;};
  try{
   signal?.throwIfAborted();await fs.mkdir(directory,{recursive:true});
   const prior=await read();if(prior&&prior.expiresAt>now()&&prior.ownerPid!==pid)throw Error('Otra instancia conserva la GPU.');
   await renew();timer=setInterval(()=>{renewal=renewal.then(renew);renewal.catch(()=>{});},intervalMs);timer.unref?.();
   onStage(role,1);await suspend();signal?.throwIfAborted();return await task();
  }finally{
   let failure,released=false;
   if(published){
    // Never reload Qwen until the validated video process has released its context.
    onStage('restoring',98);
    try{await release();released=true;}catch(error){failure=error;}
    if(!failure){
     if(await shouldRestore())try{await restore();}catch(error){failure=error;}
    }
   }
   clearInterval(timer);await renewal.catch(()=>{});
   if(published&&released){const current=await read();if(current?.nonce===nonce)await fs.rm(file,{force:true});}
   busy=false;if(failure)throw failure;
  }
 }
 return {run,get busy(){return busy;}};
}
