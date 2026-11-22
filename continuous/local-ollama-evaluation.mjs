/**
 * Explicitly local Ollama inference adapter for reproducible Atlas evaluations.
 * No remote endpoints, tools, network search or automatic model activation.
 */
export function validateOllamaOrigin(origin='http://127.0.0.1:11434'){
 const url=new URL(origin);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||
   url.username||url.password||url.search||url.hash||url.pathname!=='/')
   throw Error('Ollama endpoint must be a local HTTP origin');
 return url.origin;
}
export async function runOllamaPrompt({model,prompt,origin='http://127.0.0.1:11434',
 request=fetch,signal,timeoutMs=120000,options={}}={}){
 const base=validateOllamaOrigin(origin);
 if(typeof model!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/.test(model))
   throw Error('Invalid local model name');
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>16000)throw Error('Invalid prompt');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw Error('Invalid timeout');
 if(options===null||typeof options!=='object'||Array.isArray(options))throw Error('Invalid options');
 const allowed=new Set(['temperature','seed','num_ctx','num_predict','top_p']);
 for(const [key,value] of Object.entries(options)){
   if(!allowed.has(key)||typeof value!=='number'||!Number.isFinite(value))throw Error('Unsafe inference option');
 }
 const abort=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(signal?[signal]:[])]);
 const started=performance.now();
 const response=await request(base+'/api/generate',{
   method:'POST',redirect:'error',signal:abort,
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({model,prompt,stream:false,options}),
 });
 if(!response.ok)throw Error('Local inference failed (HTTP '+response.status+')');
 const payload=await response.json();
 const durationMs=performance.now()-started;
 if(!payload||typeof payload.response!=='string'||!payload.response.trim()||
   payload.response.length>100000||payload.done!==true)throw Error('Invalid local inference response');
 return {model,response:payload.response,durationMs,
   // Ollama reports total_duration and eval_duration in nanoseconds.
   providerTotalMs:Number.isSafeInteger(payload.total_duration)&&payload.total_duration>=0?payload.total_duration/1e6:null,
   outputTokens:Number.isSafeInteger(payload.eval_count)&&payload.eval_count>=0?payload.eval_count:null};
}
