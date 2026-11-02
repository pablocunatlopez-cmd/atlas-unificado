import fs from 'node:fs/promises';
import path from 'node:path';
import {buildExtension} from './extensions.mjs';
import {chat} from './chat.mjs';

// Frameworks share the local Qwen. Selection is based on executed contracts,
// with an exploration term for providers that have little evidence.
export function createCodingCollaborators({directory,agent,smolAgent,buildNative=buildExtension,referenceLibrary,now=Date.now}={}){
 const adapters={aider:agent,smolagents:smolAgent},names={native:'Atlas native',aider:'Aider',smolagents:'smolagents'};
 const working=new Set();
 let initialized,metrics;const file=path.join(directory,'coding-agents.json');
 const empty=()=>({attempts:0,passed:0,failed:0,cancelled:0,totalMs:0});
 async function init(){if(!initialized)initialized=(async()=>{await fs.mkdir(directory,{recursive:true});try{metrics=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;metrics={};}for(const name of Object.keys(names))metrics[name]={...empty(),...metrics[name]};}) ();await initialized;}
 async function save(){await fs.writeFile(file+'.tmp',JSON.stringify(metrics,null,2));await fs.rename(file+'.tmp',file);}
 const score=record=>record.attempts===0?Infinity:(record.passed+1)/(record.attempts+2)+Math.sqrt(2*Math.log(2+Object.keys(names).reduce((n,key)=>n+metrics[key].attempts,0))/(record.attempts+1))-Math.min(.15,record.totalMs/record.attempts/600000*.15);
 async function status(){await init();const result={};for(const [name,adapter] of Object.entries(adapters)){const installed=await adapter?.status().catch(()=>({installed:false,ready:false}));result[name]={installed:installed?.installed===true,ready:installed?.ready===true,busy:working.has(name)||installed?.busy===true,inferenceVerified:installed?.inferenceVerified===true,...metrics[name]};}return {...result,native:{installed:true,ready:true,busy:working.has('native'),inferenceVerified:metrics.native.attempts>0,...metrics.native},independentModels:0,selection:'Contratos ejecutados y exploración acotada; todos usan Qwen local.'};}
 async function build(task,key,cases,generate,options={}){
  await init();const signal=options.signal,availability=await status();
  let referenceContext='',sourceReferences=[],referenceErrors=[],referenceContextProvided=false;
  if(referenceLibrary?.get&&options.curriculumTaskId){
   try{const snapshot=await referenceLibrary.get(options.curriculumTaskId,{signal});signal?.throwIfAborted();if(typeof snapshot?.context==='string'&&snapshot.context.length<=1800){referenceContext=snapshot.context;sourceReferences=(Array.isArray(snapshot.references)?snapshot.references:[]).slice(0,2).map(({url,finalUrl,hash,fetchedAt,cached,stale,charsUsed})=>({url,finalUrl,hash,fetchedAt,cached,stale,charsUsed}));referenceErrors=(Array.isArray(snapshot.errors)?snapshot.errors:[]).slice(0,3).map(({url,error})=>({url,error}));}}catch{signal?.throwIfAborted();referenceErrors=[{error:'reference_unavailable'}];}
  }
  const candidates=[...Object.keys(adapters).filter(name=>availability[name].ready&&cases.length),'native'];
  const provider=candidates.includes(options.provider)?options.provider:candidates.reduce((best,name)=>score(metrics[name])>score(metrics[best])?name:best);
  const started=now();let record;
  working.add(provider);
  try{
   const generator=provider!=='native'?async input=>{
    signal?.throwIfAborted();const previous=[...input.messages].reverse().find(message=>message.role==='assistant')?.content;
    const feedback=previous?input.messages.at(-1).content:'';
    referenceContextProvided=referenceContext.length>0;
    const candidate=await adapters[provider].buildCandidate({task:(task+(feedback?'\nCorrecciones observadas: '+feedback:'')).slice(0,4000),currentCode:previous,contract:cases,name:options.name,referenceContext},{signal});
    return {answer:candidate.code,model:'atlas-local'};
   }:async(input,...args)=>{
    let next=input;const first=input.messages?.findIndex(message=>message.role==='user')??-1;
    if(referenceContext&&first>=0&&input.messages[first].content.length+referenceContext.length+2<=6000&&input.messages.reduce((sum,message)=>sum+message.content.length,0)+referenceContext.length+2<=24000){next={...input,messages:input.messages.map((message,index)=>index===first?{...message,content:message.content+'\n\n'+referenceContext}:message)};referenceContextProvided=true;}
    return (generate||chat)(next,...args);
   };
   record=await buildNative(task,key,cases,generator,{...options,format:provider!=='native'?'code':options.format});
   const elapsedMs=Math.max(0,now()-started),stat=metrics[provider];stat.attempts++;stat[record.passed?'passed':'failed']++;stat.totalMs+=elapsedMs;await save();
   return {...record,sourceReferences,referenceErrors,referenceContextProvided,collaborator:{framework:names[provider],model:'Qwen local',independentModels:false,elapsedMs,selection:'Contratos ejecutados; los fallos se conservan.'}};
  }catch(error){
   const stat=metrics[provider];if(signal?.aborted){stat.cancelled++;await save();throw error;}
   stat.attempts++;stat.failed++;stat.totalMs+=Math.max(0,now()-started);await save();
   if(provider!=='native')return build(task,key,cases,generate,{...options,provider:'native'});
   throw error;
  }finally{working.delete(provider);}
 }
 return {build,status};
}
