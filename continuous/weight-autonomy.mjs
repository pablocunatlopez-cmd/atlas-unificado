import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createWeightAutonomy({directory,evolution,runExclusive,now=Date.now}={}){
 const file=path.join(directory,'weight-autonomy.json');let initialized,state,busy=false;
 async function save(){await fs.writeFile(file+'.tmp',JSON.stringify(state,null,2));await fs.rename(file+'.tmp',file);}
 async function init(){if(!initialized)initialized=(async()=>{await fs.mkdir(directory,{recursive:true});try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;state={enabled:true,minimumHours:6,lastAttempt:now(),lastEvidenceHash:null,attempts:0,trained:0,waitReason:'budget',activeAdapter:false};await save();}})();await initialized;}
 async function status(){await init();const hours=Math.max(1,Math.min(24,Number(state.minimumHours)||6));return {enabled:state.enabled!==false,running:busy,minimumHours:hours,attempts:state.attempts,trained:state.trained,waitReason:state.waitReason,nextCheckAfter:new Date(state.lastAttempt+hours*3600000).toISOString(),activeAdapter:false};}
 async function tick(tools,{signal,isIdle=true}={}){
  await init();if(busy)return {status:'busy'};if(state.enabled===false)return {status:'disabled'};
  const policy=await status();if(!isIdle){state.waitReason='foreground';return {status:'waiting'};}if(now()<state.lastAttempt+policy.minimumHours*3600000){state.waitReason='budget';return {status:'waiting'};}
  const records=tools.filter(tool=>tool.passed===true&&tool.testOrigin==='external-contract'&&tool.curriculumTaskId&&Array.isArray(tool.acceptanceTests)&&tool.acceptanceTests.length>=4).slice(-4);
  if(!records.length){state.waitReason='verified_data';return {status:'waiting'};}
  const evidenceHash=digest(records.map(tool=>({task:tool.curriculumTaskId,source:tool.source,tests:tool.acceptanceTests})).sort((a,b)=>a.task.localeCompare(b.task)));
  if(evidenceHash===state.lastEvidenceHash){state.waitReason='new_evidence';return {status:'waiting'};}
  const runtime=await evolution.status();if(!runtime.ready){state.waitReason='runtime';return {status:'waiting'};}
  signal?.throwIfAborted();busy=true;
  try{
   // The runtime re-executes tool contracts before constructing the corpus.
   const candidate=await evolution.prepareFromVerifiedTools(records);signal?.throwIfAborted();
   if(candidate.learningDataFingerprint&&candidate.learningDataFingerprint===state.lastLearningDataFingerprint){state.lastEvidenceHash=evidenceHash;state.waitReason='new_evidence';await save();return {status:'waiting'};}
   state.lastAttempt=now();state.lastEvidenceHash=evidenceHash;state.lastLearningDataFingerprint=candidate.learningDataFingerprint||null;state.attempts++;state.waitReason='running';await save();
   const result=await runExclusive(candidate,{signal});signal?.throwIfAborted();
   if(result.trained)state.trained++;state.waitReason='new_evidence';state.lastCandidateId=candidate.id;state.lastGate=result.gate;state.activeAdapter=false;await save();
   return {status:'candidate_evaluated',id:candidate.id,trained:result.trained,active:false,gate:result.gate};
  }catch(error){state.waitReason=signal?.aborted?'foreground':'trial_failed';if(!signal?.aborted)state.lastEvidenceHash=evidenceHash;state.lastAttempt=now();await save();if(signal?.aborted)throw error;return {status:'trial_failed',active:false};}
  finally{busy=false;}
 }
 return {status,tick};
}
