import {measureAtlasLocalInference} from './atlas-local-inference-probe.mjs';
/**
 * Deterministic local evaluation. Exact-match checks are deliberately narrow:
 * they cannot establish general reasoning ability or truthfulness.
 * All inference is opt-in through the injected local infer callback.
 */
export async function evaluateAtlasLocalModel({
 infer,cases,clock,readMemory,maxCases=20
}={}){
 if(typeof infer!=='function'||!Array.isArray(cases)||cases.length<1||
  cases.length>maxCases||!Number.isSafeInteger(maxCases)||maxCases<1||maxCases>100)
  throw Error('Invalid local evaluation');
 const ids=new Set();
 for(const item of cases){
  if(!item||typeof item.id!=='string'||!/^[a-z0-9_-]{1,64}$/.test(item.id)||
   ids.has(item.id)||typeof item.prompt!=='string'||!item.prompt.trim()||
   item.prompt.length>2000||typeof item.expected!=='string'||
   !item.expected.trim()||item.expected.length>2000)
   throw Error('Invalid evaluation case');
  ids.add(item.id);
 }
 const results=[];
 for(const item of cases){
  let answer=null;
  const measurement=await measureAtlasLocalInference({
   infer:async prompt=>{
    const response=await infer(prompt);
    answer=typeof response==='string'?response:response?.answer;
    if(typeof answer!=='string')throw Error('Invalid local answer');
    return {answer};
   },prompt:item.prompt,...(clock?{clock}:{}),
   ...(readMemory?{readMemory}:{})
  });
  const passed=measurement.status==='completed'&&
   answer.trim()===item.expected.trim();
  results.push(Object.freeze({
   id:item.id,passed,elapsedMs:measurement.elapsedMs,
   status:measurement.status,error:measurement.error,
   responseChars:measurement.responseChars
  }));
 }
 const passed=results.filter(x=>x.passed).length;
 return Object.freeze({
  status:'completed',total:results.length,passed,failed:results.length-passed,
  exactMatchRate:passed/results.length,
  cases:Object.freeze(results),
  scope:'exact_match_only',
  generalReasoningVerified:false,
  runOnUserMachine:'host_dependent',
  modelIdentityVerified:false
 });
}
