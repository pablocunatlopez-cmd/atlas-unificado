/**
 * Passive CPU inference probe. No downloads, model startup or remote calls.
 * Host supplies the local llama client and memory/clock functions.
 */
export async function measureAtlasLocalInference({
 infer,readMemory=()=>process.memoryUsage().rss,
 clock=()=>performance.now(),prompt='Responde solo: OK',
 maxPromptChars=2000
}={}){
 if(typeof infer!=='function'||typeof readMemory!=='function'||
  typeof clock!=='function'||typeof prompt!=='string'||!prompt.trim()||
  prompt.length>maxPromptChars||!Number.isSafeInteger(maxPromptChars)||
  maxPromptChars<1||maxPromptChars>8000)
  throw Error('Invalid local inference probe');
 const before=readMemory(),start=clock();
 if(!Number.isFinite(before)||before<0||!Number.isFinite(start))
  throw Error('Invalid probe baseline');
 let result,failed=false;
 try{result=await infer(prompt);}
 catch(error){failed=true;result={error:String(error?.message??'inference_failed').slice(0,200)};}
 const elapsedMs=clock()-start,after=readMemory();
 if(!Number.isFinite(elapsedMs)||elapsedMs<0||!Number.isFinite(after)||after<0)
  throw Error('Invalid probe measurement');
 return Object.freeze({
  status:failed?'failed':'completed',
  elapsedMs:Math.round(elapsedMs*100)/100,
  hostProcessRssBeforeMb:Math.round(before/1048576*100)/100,
  hostProcessRssAfterMb:Math.round(after/1048576*100)/100,
  hostProcessRssDeltaMb:Math.round((after-before)/1048576*100)/100,
  responseChars:typeof result?.answer==='string'?result.answer.length:null,
  error:failed?result.error:null,
  memoryScope:'host_process_only_not_llama_server',
  measuredOnUserMachine:false,
  modelVerified:false
 });
}
