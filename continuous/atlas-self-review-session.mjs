import {createAtlasOllamaLoopbackTransport} from './atlas-self-improvement-ollama-transport.mjs';
import {createAtlasOllamaProposalAdapter} from './atlas-self-improvement-ollama.mjs';
import {proposeAtlasSelfImprovement} from './atlas-self-improvement-generator.mjs';
/**
 * Explicit opt-in Ollama self-review session.
 * A model inference is performed when run() is called, but generated code,
 * repository writes, tests, shell commands and deployments are never run here.
 * Callers must supply trusted, pre-read and bounded repository context.
 */
export function createAtlasSelfReviewSession({
 fetchImpl,model='qwen2.5:7b',endpoint,timeoutMs,maxResponseBytes
}={}){
 const requestModel=createAtlasOllamaLoopbackTransport({
  fetchImpl,endpoint,timeoutMs,maxResponseBytes
 });
 const generateProposal=createAtlasOllamaProposalAdapter({model,requestModel});
 return Object.freeze({
  mode:'dry_run',
  async run({constitution,roadmap,repositoryContext,rejectedHistory=[]}={}){
   const result=await proposeAtlasSelfImprovement({
    constitution,roadmap,repositoryContext,rejectedHistory,generateProposal
   });
   return Object.freeze({
    schemaVersion:1,mode:'dry_run',model,
    proposal:result.plan.proposals[0],review:result.review.reviews[0],
    contextDigest:result.contextDigest,
    trust:result.modelOutputTrust,
    codeExecuted:false,patchApplied:false,testsExecuted:false,
    authorizationGranted:false,
    note:'Model inference is performed; generated code is never executed or applied'
   });
  }
 });
}
