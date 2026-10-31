import {Worker} from 'node:worker_threads';
import os from 'node:os';
export function workerBudget(requested){
 return Math.max(1,Math.min(requested,6,Math.max(1,os.availableParallelism()-2),Math.floor(os.freemem()/(400*1024*1024))));
}
export async function compareCandidates(snapshot,documents,steps,requested,cancelled=()=>false){
 const count=workerBudget(requested);
 const rates=[.025,.015,.008,.035,.005,.02];
 const results=await Promise.allSettled(Array.from({length:count},(_,index)=>new Promise((resolve,reject)=>{
  const options={seed:109+index*997,learningRate:rates[index]};
  const worker=new Worker(new URL('./training-worker.mjs',import.meta.url),{workerData:{snapshot,documents,steps,options},resourceLimits:{maxOldGenerationSizeMb:256}});
  let finished=false;
  const finish=(error,result)=>{if(finished)return;finished=true;clearInterval(poll);clearTimeout(deadline);worker.terminate();error?reject(error):resolve({...result,index,options});};
  const poll=setInterval(()=>{if(cancelled())finish(Error('Entrenamiento pausado.'));},100);
  const deadline=setTimeout(()=>finish(Error('Candidato excedió 120 segundos.')),120000);
  worker.once('message',m=>m.ok?finish(null,m.result):finish(Error(m.error)));
  worker.once('error',e=>finish(e));
  worker.once('exit',code=>{if(!finished)finish(Error(`Trabajador terminó sin resultado (${code}).`));});
 })));
 if(cancelled())throw Error('Entrenamiento pausado.');
 const good=results.filter(r=>r.status==='fulfilled').map(r=>r.value).sort((a,b)=>a.metrics.after-b.metrics.after);
 if(!good.length)throw Error('Fallaron todos los candidatos: '+results.map(r=>r.reason?.message).join('; '));
 const best=good[0];
 return {candidate:best.candidate,metrics:{...best.metrics,candidateCount:count,selectedCandidate:best.index,
  attemptedStepsTotal:good.reduce((sum,r)=>sum+r.metrics.steps,0),
  candidates:results.map((r,index)=>r.status==='fulfilled'?{index,seed:r.value.options.seed,learningRate:r.value.options.learningRate,...r.value.metrics}:{index,error:r.reason?.message}),
  evaluation:'Selección entre candidatos con validación reutilizada; no test ciego ni inteligencia general.'}};
}
