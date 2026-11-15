/**
 * Bounded, auditable agent workflow inspired by SWE-agent and LangGraph.
 * No shell, filesystem, network or deployment permissions are granted here.
 * Callers supply explicit handlers and must sandbox untrusted execution.
 */
export async function runAgentWorkflow({steps,handlers,signal,maxSteps=12,timeoutMs=60000,onEvent=()=>{}}={}){
 if(!Array.isArray(steps)||steps.length===0||steps.length>maxSteps||
   !Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>100||
   !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>300000)
   throw Error('Invalid workflow budget');
 if(!handlers||typeof handlers!=='object')throw Error('Handlers required');
 const events=[],results=[];
 const started=performance.now();
 for(let i=0;i<steps.length;i++){
   signal?.throwIfAborted();
   if(performance.now()-started>=timeoutMs)throw Error('Workflow time budget exceeded');
   const step=steps[i];
   if(!step||typeof step.kind!=='string'||!Object.hasOwn(handlers,step.kind)||
      typeof handlers[step.kind]!=='function')throw Error('Unapproved workflow step');
   const remaining=Math.max(1,Math.ceil(timeoutMs-(performance.now()-started)));
   const controller=new AbortController();
   const abort=AbortSignal.any([controller.signal,AbortSignal.timeout(remaining),...(signal?[signal]:[])]);
   const event={index:i,kind:step.kind,status:'started'};
   events.push(event);onEvent(event);
   try{
     const value=await Promise.race([
       Promise.resolve().then(()=>handlers[step.kind](step.input,{signal:abort})),
       new Promise((_,reject)=>abort.addEventListener('abort',()=>reject(abort.reason),{once:true})),
     ]);
     const done={index:i,kind:step.kind,status:'completed'};
     events.push(done);onEvent(done);
     results.push(value);
   }catch(error){
     controller.abort();
     const failed={index:i,kind:step.kind,status:'failed',errorCode:'step_failed'};
     events.push(failed);onEvent(failed);
     return {ok:false,results,events,failedAt:i};
   }finally{controller.abort();}
 }
 return {ok:true,results,events};
}
