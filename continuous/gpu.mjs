import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TinyLanguageModel,encode,validateSnapshot} from '../public/core/language-model.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export async function compareGpu(snapshot,documents,config,cancelled=()=>false){
 const job=await fs.mkdtemp(path.join(root,'data','gpu-job-'));
 const input=path.join(job,'input.json'),output=path.join(job,'output.json');
 await fs.writeFile(input,JSON.stringify({snapshot,documents,gpuUpdates:config.gpuUpdates||300,batchSize:config.gpuBatchSize||256}));
 try{
  await new Promise((resolve,reject)=>{
   const proc=spawn(config.gpuPython,[path.join(root,'gpu_train.py'),'--input',input,'--output',output],{windowsHide:true,stdio:['ignore','ignore','pipe']});
   let stderr='',reason=null;proc.stderr.on('data',d=>{stderr=(stderr+d).slice(-3000);});
   const timer=setTimeout(()=>{reason='Entrenamiento GPU excedió cinco minutos';proc.kill();},300000);
   const poll=setInterval(()=>{if(cancelled()){reason='Entrenamiento pausado.';proc.kill();}},100);
   const done=e=>{clearTimeout(timer);clearInterval(poll);e?reject(e):resolve();};
   proc.once('error',done);proc.once('close',code=>done(code===0&&!reason?null:Error(reason||stderr||'Falló el proceso GPU')));
  });
  const result=JSON.parse(await fs.readFile(output,'utf8'));
  if(!validateSnapshot(result.candidate))throw Error('Checkpoint GPU incompatible');
  // Final promotion gate uses the original Sites evaluator, not only the port.
  const val=documents.filter(d=>d.role==='validation').map(d=>encode(d.text));
  const evaluate=s=>{const m=new TinyLanguageModel(s);return val.reduce((sum,d)=>sum+m.evaluate(d,100),0)/val.length;};
  result.metrics.cudaBefore=result.metrics.before;result.metrics.cudaAfter=result.metrics.after;
  result.metrics.before=evaluate(snapshot);result.metrics.after=evaluate(result.candidate);
  result.metrics.accepted=result.metrics.after<result.metrics.before-.001;
  result.metrics.originalEvaluatorVerified=true;
  return result;
 }finally{
  // Only remove our two known temporary files. Keep the directory as an audit boundary.
  await fs.rm(input,{force:true});await fs.rm(output,{force:true});await fs.rmdir(job);
 }
}
