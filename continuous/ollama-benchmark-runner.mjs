import {runOllamaPrompt} from './local-ollama-evaluation.mjs';

/**
 * Deterministic evaluation harness. A test's expected text is controlled by
 * the benchmark author; model output never supplies its own verdict.
 */
export async function evaluateOllamaCases({model,cases,origin,request,signal,options}={}){
 if(!Array.isArray(cases)||cases.length===0||cases.length>100)
   throw Error('Expected 1..100 benchmark cases');
 const ids=new Set(),runs=[];
 for(const item of cases){
   if(!item||typeof item.id!=='string'||!item.id.trim()||ids.has(item.id)||
     typeof item.prompt!=='string'||!item.prompt.trim()||
     typeof item.expected!=='string'||!item.expected.trim())
     throw Error('Invalid or duplicate benchmark case');
   ids.add(item.id);
 }
 for(const item of cases){
   signal?.throwIfAborted();
   const output=await runOllamaPrompt({model,prompt:item.prompt,origin,request,signal,options});
   // Non-streaming API cannot measure time to first token. Use total time as
   // a conservative upper bound, never label it as measured TTFT.
   runs.push({id:item.id,passed:output.response.trim()===item.expected.trim(),
     durationMs:output.durationMs,ttftMs:output.durationMs});
 }
 return runs;
}
