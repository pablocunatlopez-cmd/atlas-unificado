import {createHash} from 'node:crypto';
import {planAtlasSelfImprovement} from './atlas-self-improvement-planner.mjs';
import {critiqueAtlasSelfImprovement} from './atlas-self-improvement-critic.mjs';
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
/**
 * Model-adapter proposal generation in dry-run mode.
 * The injected generateProposal callback is untrusted: it may only return
 * structured data. No shell, file-write or patch-apply capability is exposed.
 */
export async function proposeAtlasSelfImprovement({
 constitution,roadmap,repositoryContext,generateProposal,rejectedHistory=[]
}={}){
 if(typeof repositoryContext!=='string'||!repositoryContext.trim()||
    repositoryContext.length>40000||typeof generateProposal!=='function')
  throw Error('Bounded repository context and model adapter required');
 if(!Array.isArray(rejectedHistory)||rejectedHistory.length>200||
    rejectedHistory.some(x=>typeof x!=='string'||x.length>1000))
  throw Error('Invalid negative memory');
 const prompt=Object.freeze({
  task:'Suggest one improvement grounded in the supplied context. Return structured observations only.',
  constraints:Object.freeze(['Do not execute code','Do not claim tests ran',
   'Do not request credentials','Do not modify repository',
   'Cite exact constitution principle and roadmap substring',
   'Provide at least two candidates and acceptance criteria']),
  constitution,roadmap,repositoryContext,
  rejectedHistory:Object.freeze([...rejectedHistory])
 });
 const raw=await generateProposal(prompt);
 if(!raw||!Array.isArray(raw.observations)||raw.observations.length!==1||
    !raw.observations[0]||!ID.test(raw.observations[0].id||''))
  throw Error('Model returned invalid proposal envelope');
 const plan=planAtlasSelfImprovement({
  constitution,roadmap,observations:raw.observations
 });
 const review=critiqueAtlasSelfImprovement(plan,{rejectedHistory});
 return Object.freeze({schemaVersion:1,mode:'dry_run',plan,review,
  contextDigest:createHash('sha256').update(repositoryContext).digest('hex'),
  modelOutputTrust:'unverified_model_generated',
  codeExecuted:false,patchApplied:false,authorizationGranted:false,
  note:'Adapter behavior is host-controlled; output validation is not a sandbox'});
}
