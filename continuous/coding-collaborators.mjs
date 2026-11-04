import fs from 'node:fs/promises';
import path from 'node:path';
import {buildExtension} from './extensions.mjs';
import {chat} from './chat.mjs';
import {AUTONOMOUS_TASK_IDS} from './autonomy-curriculum.mjs';
import {createQueuedJsonWriter} from './queued-json-writer.mjs';

// Frameworks share the local Qwen. Selection is based on executed contracts,
// with an exploration term for providers that have little evidence.
export function createCodingCollaborators({directory,agent,smolAgent,buildNative=buildExtension,referenceLibrary,now=Date.now}={}){
 const adapters={aider:agent,smolagents:smolAgent},names={native:'Atlas native',aider:'Aider',smolagents:'smolagents'};
 const working=new Set();
 let initialized,metrics;const file=path.join(directory,'coding-agents.json'),writer=createQueuedJsonWriter({directory});
 const empty=()=>({attempts:0,passed:0,failed:0,cancelled:0,totalMs:0});
 const clean=value=>{const result=Object.fromEntries(Object.keys(empty()).map(key=>[key,Number.isSafeInteger(value?.[key])&&value[key]>=0?value[key]:0]));result.passed=Math.min(result.attempts,result.passed);result.failed=Math.min(result.attempts-result.passed,result.failed);return result;};
 async function init(){if(!initialized)initialized=(async()=>{
  await fs.mkdir(directory,{recursive:true});let saved;try{saved=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;saved={};}
  metrics=Object.fromEntries(Object.keys(names).map(name=>[name,clean(saved?.[name])]));metrics.taskMetrics={};
  for(const id of AUTONOMOUS_TASK_IDS)if(saved?.taskMetrics?.[id])metrics.taskMetrics[id]=Object.fromEntries(Object.keys(names).map(name=>[name,clean(saved.taskMetrics[id][name])]));
 }) ();await initialized;}
 const save=()=>writer.write('coding-agents.json',metrics);
 const score=(record,group)=>record.attempts===0?Infinity:(record.passed+1)/(record.attempts+2)+Math.sqrt(2*Math.log(2+Object.keys(names).reduce((n,key)=>n+group[key].attempts,0))/(record.attempts+1))-Math.min(.15,record.totalMs/record.attempts/600000*.15);
 async function status(){await init();const result={};for(const [name,adapter] of Object.entries(adapters)){const installed=await adapter?.status().catch(()=>({installed:false,ready:false}));result[name]={installed:installed?.installed===true,ready:installed?.ready===true,busy:working.has(name)||installed?.busy===true,inferenceVerified:installed?.inferenceVerified===true,...metrics[name]};}return {...result,native:{installed:true,ready:true,busy:working.has('native'),inferenceVerified:metrics.native.attempts>0,...metrics.native},taskMetrics:structuredClone(metrics.taskMetrics),measurementScope:'builder-contracts',independentModels:0,selection:'Contratos del constructor por familia de tarea, coste observado y exploración acotada; todos usan Qwen local. La confirmación y promoción final se comprueban aparte. El historial global se conserva sin inventar resultados por tarea.'};}
 async function build(task,key,cases,generate,options={}){
  await init();const signal=options.signal,availability=await status();
  let referenceContext='',sourceReferences=[],referenceErrors=[],referenceContextProvided=false;
  if(referenceLibrary?.get&&options.curriculumTaskId){
   try{const snapshot=await referenceLibrary.get(options.curriculumTaskId,{signal});signal?.throwIfAborted();if(typeof snapshot?.context==='string'&&snapshot.context.length<=1800){referenceContext=snapshot.context;sourceReferences=(Array.isArray(snapshot.references)?snapshot.references:[]).slice(0,2).map(({url,finalUrl,hash,fetchedAt,cached,stale,charsUsed})=>({url,finalUrl,hash,fetchedAt,cached,stale,charsUsed}));referenceErrors=(Array.isArray(snapshot.errors)?snapshot.errors:[]).slice(0,3).map(({url,error})=>({url,error}));}}catch{signal?.throwIfAborted();referenceErrors=[{error:'reference_unavailable'}];}
  }
  const taskId=AUTONOMOUS_TASK_IDS.includes(options.curriculumTaskId)?options.curriculumTaskId:null;
  const group=taskId?(metrics.taskMetrics[taskId]??=Object.fromEntries(Object.keys(names).map(name=>[name,empty()]))):metrics;
  const candidates=[...Object.keys(adapters).filter(name=>availability[name].ready&&!availability[name].busy&&cases.length),'native'];
  const provider=candidates.includes(options.provider)?options.provider:candidates.reduce((best,name)=>score(group[name],group)>score(group[best],group)?name:best);
  const selectionEvidence=candidates.map(id=>({id,attempts:group[id].attempts,passed:group[id].passed,failed:group[id].failed,meanMs:group[id].attempts?Math.round(group[id].totalMs/group[id].attempts):null,exploration:group[id].attempts===0,score:Number.isFinite(score(group[id],group))?score(group[id],group):null}));
  const measure=(kind,elapsedMs=0)=>{for(const stat of taskId?[metrics[provider],group[provider]]:[metrics[provider]]){if(kind==='cancelled')stat.cancelled++;else{stat.attempts++;stat[kind]++;stat.totalMs+=Math.round(elapsedMs);}}};
  const started=now();let record,measured=false;
  working.add(provider);
  try{
   const generator=provider!=='native'?async input=>{
    signal?.throwIfAborted();const previous=[...input.messages].reverse().find(message=>message.role==='assistant')?.content;
    const feedback=previous&&typeof input.messages.at(-1)?.content==='string'?input.messages.at(-1).content.slice(-3000):'';
    referenceContextProvided=referenceContext.length>0;
    const candidate=await adapters[provider].buildCandidate({task,currentCode:previous,contract:cases,name:options.name,referenceContext,repairContext:feedback},{signal});
    return {answer:candidate.code,model:'atlas-local'};
   }:async(input,...args)=>{
    let next=input;const first=input.messages?.findIndex(message=>message.role==='user')??-1;
    if(referenceContext&&first>=0&&input.messages[first].content.length+referenceContext.length+2<=6000&&input.messages.reduce((sum,message)=>sum+message.content.length,0)+referenceContext.length+2<=24000){next={...input,messages:input.messages.map((message,index)=>index===first?{...message,content:message.content+'\n\n'+referenceContext}:message)};referenceContextProvided=true;}
    return (generate||chat)(next,...args);
   };
   record=await buildNative(task,key,cases,generator,{...options,format:provider!=='native'?'code':options.format});
   const elapsedMs=Math.max(0,now()-started);measured=true;measure(record.passed===true?'passed':'failed',elapsedMs);await save();
   return {...record,sourceReferences,referenceErrors,referenceContextProvided,collaborator:{framework:names[provider],model:'Qwen local',independentModels:false,elapsedMs,selectionScope:taskId?'task':'global',curriculumTaskId:taskId,selectionEvidence,selection:'Contratos ejecutados por familia; muestras limitadas y exploración no equivalen a superioridad general.'}};
  }catch(error){
   if(measured)throw error;
   if(signal?.aborted){measure('cancelled');await save();throw error;}
   measure('failed',Math.max(0,now()-started));await save();
   if(provider!=='native')return build(task,key,cases,generate,{...options,provider:'native'});
   throw error;
  }finally{working.delete(provider);}
 }
 return {build,status};
}
