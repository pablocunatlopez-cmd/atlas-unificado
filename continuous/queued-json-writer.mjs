import fs from 'node:fs/promises';
import path from 'node:path';

function jsonName(name){
 if(typeof name!=='string'||name.length>180||!/^[a-z0-9][a-z0-9._-]*\.json$/i.test(name)||path.basename(name)!==name||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw new TypeError('El nombre debe ser un archivo JSON simple dentro del directorio.');
 return name;
}

/** One writer owns one serialized commit queue. Each call snapshots its JSON at
 * enqueue time. Cancellation can reject before rename; once rename is invoked,
 * it is the commit point and a later abort cannot turn that commit into failure.
 * Callers observe errors on write(); drain() only waits for already queued work. */
export function createQueuedJsonWriter({directory,fsAdapter=fs}={}){
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw new TypeError('Se requiere un directorio absoluto.');
 if(!fsAdapter||['mkdir','writeFile','rename','rm'].some(method=>typeof fsAdapter[method]!=='function'))throw new TypeError('El adaptador de archivos está incompleto.');
 const root=path.resolve(directory);let tail=Promise.resolve();
 function write(name,value,{signal}={}){
  let serialized,file;
  try{
   jsonName(name);signal?.throwIfAborted();
   serialized=JSON.stringify(value,null,2);
   if(typeof serialized!=='string')throw new TypeError('El valor no se puede guardar como JSON.');
   file=path.join(root,name);
  }catch(error){return Promise.reject(error);}
  const operation=tail.then(async()=>{
   signal?.throwIfAborted();
   await fsAdapter.mkdir(root,{recursive:true});
   signal?.throwIfAborted();let attemptedWrite=false;
   try{
    // Check inside the queue: an earlier operation may have delayed this one.
    signal?.throwIfAborted();attemptedWrite=true;
    await fsAdapter.writeFile(file+'.tmp',serialized,'utf8');
    // This check is both after writeFile and immediately before the commit.
    signal?.throwIfAborted();
    await fsAdapter.rename(file+'.tmp',file);
   }catch(error){
    if(attemptedWrite)try{await fsAdapter.rm(file+'.tmp',{force:true});}catch{}
    throw error;
   }
  });
  // A rejected write remains rejected for its caller, while the next write gets
  // a settled queue and can proceed. Cleanup finishes before the next starts.
  tail=operation.catch(()=>{});
  return operation;
 }
 return {write,drain:()=>tail};
}
