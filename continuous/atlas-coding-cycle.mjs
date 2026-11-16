import {createHash} from 'node:crypto';
import {buildAtlasRepoMap,selectAtlasRepoContext,selectAtlasAffectedModules} from './atlas-repo-map.mjs';
import {planAtlasPatch} from './atlas-patch-planner.mjs';
import {evaluateAtlasAgentChange} from './atlas-agent-change-gate.mjs';

/**
 * Atlas coding cycle: deterministic plan -> context -> review gate.
 * This function never executes code, modifies a repository or asserts
 * that checks have actually run.
 */
export function planAtlasCodingCycle({proposalId,repositoryFiles,targets,changes,checks={},approval=null,
 contextLimits={}}={}){
 const repoMap=buildAtlasRepoMap(repositoryFiles);
 const context=selectAtlasRepoContext(repoMap,{targets,...contextLimits});
 const patch=planAtlasPatch({proposalId,files:changes});
 // Hash actual requested contents, not just path/size metadata.
 const diffDigest=createHash('sha256').update(JSON.stringify({
  domain:'atlas.coding.patch.v1',proposalId,
  changes:changes.map(c=>({operation:c.operation,path:c.path,
   ...(c.operation==='delete'?{}:{content:c.content})}))
 })).digest('hex');
 const impact=selectAtlasAffectedModules(repoMap,{targets:patch.changes.map(c=>c.path)});
 const missingReadTargets=context.missingTargets;
 const missingChangeTargets=patch.changes.filter(c=>c.operation!=='create'&&!repoMap.files.some(f=>f.path===c.path)).map(c=>c.path);
 const existingCreates=patch.changes.filter(c=>c.operation==='create'&&repoMap.files.some(f=>f.path===c.path)).map(c=>c.path);
 const unresolved=[...new Set([...missingReadTargets,...missingChangeTargets,...existingCreates])];
 const actions=patch.changes.map(c=>({kind:c.operation==='delete'?'delete':'write',target:c.path}));
 const review=evaluateAtlasAgentChange({id:proposalId,actions,checks,approval});
 return Object.freeze({
  schemaVersion:2,proposalId,diffDigest,context,impact,patch,review,unresolved,
  status:'planned_not_executed',
  // Legacy review flags are caller-provided, not authenticated evidence.
  verifiedReady:false,
  nextStep:unresolved.length?'resolve_missing_or_conflicting_files':'verify_commit_bound_evidence',
 });
}

/**
 * Optional trusted-host review claim for a previously planned cycle.
 * This separate phase cannot mutate the repository or execute commands.
 */
export async function claimAtlasCodingCycleReview({cycle,claim,publicKey,nowMs,directory,authorizeActor,expected,readHeadCommit}={}){
 if(!cycle||cycle.status!=='planned_not_executed'||cycle.verifiedReady!==false||
    !cycle.review||cycle.unresolved?.length||!cycle.patch||
    typeof cycle.proposalId!=='string'||!expected||
    typeof expected!=='object'||expected.proposalId!==cycle.proposalId)
  throw Error('A complete unresolved-free planned coding cycle is required');
 const {claimAtlasCodingReview}=await import('./atlas-coding-review-claim.mjs');
 if(typeof readHeadCommit!=='function')
  throw Error('Trusted repository HEAD reader required');
 if(expected.diffDigest!==cycle.diffDigest)
  return Object.freeze({status:'blocked',reason:'patch_digest_mismatch',authorizationGranted:false,executesCode:false});
 if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expected.baseCommit||''))
  return Object.freeze({status:'blocked',reason:'invalid_base_commit',authorizationGranted:false,executesCode:false});
 const currentHead=await readHeadCommit();
 if(currentHead!==expected.baseCommit)
  return Object.freeze({status:'blocked',reason:'stale_base_commit',authorizationGranted:false,executesCode:false});
 if(claim?.proposalId!==cycle.proposalId)
  return Object.freeze({status:'blocked',reason:'proposal_mismatch',authorizationGranted:false,executesCode:false});
 return claimAtlasCodingReview({claim,publicKey,expected,nowMs,directory,authorizeActor});
}
