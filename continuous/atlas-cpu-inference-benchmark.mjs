/**
 * CPU-only inference benchmark with an injected, trusted inference callback.
 * Uses a monotonic clock and never asserts tokens/s without a token count.
 */
export async function benchmarkAtlasCpuInference({infer,prompt='Hola',runs=3,now=()=>performance.now()}={}){
 if(typeof infer!=='function'||typeof prompt!=='string'||prompt.length>4000||
  !Number.isSafeInteger(runs)||runs<1||runs>10||typeof now!=='function')
  throw Error('Invalid CPU benchmark request');
 const measurements=[];
 for(let i=0;i<runs;i++){
  const start=now();
  const result=await infer(prompt);
  const end=now();
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||
   !result||typeof result.answer!=='string')
   throw Error('Invalid CPU benchmark measurement');
  measurements.push(Object.freeze({elapsedMs:end-start,characters:result.answer.length,
   outputTokens:Number.isSafeInteger(result.outputTokens)&&result.outputTokens>=0?
    result.outputTokens:null}));
 }
 const elapsed=measurements.map(x=>x.elapsedMs).sort((a,b)=>a-b);
 const medianMs=elapsed[Math.floor(elapsed.length/2)];
 return Object.freeze({device:'cpu',runs,medianMs,measurements,
  measured:true,modelVerified:false,qualityEvaluated:false,
  note:'Timing measures the injected callback, not necessarily CPU-only inference'});
}
