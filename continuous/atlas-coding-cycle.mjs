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
 const impact=selectAtlasAffectedModules(repoMap,{targets:patch.changes.map(c=>c.path)});
 const missingReadTargets=context.missingTargets;
 const missingChangeTargets=patch.changes.filter(c=>c.operation!=='create'&&!repoMap.files.some(f=>f.path===c.path)).map(c=>c.path);
 const existingCreates=patch.changes.filter(c=>c.operation==='create'&&repoMap.files.some(f=>f.path===c.path)).map(c=>c.path);
 const unresolved=[...new Set([...missingReadTargets,...missingChangeTargets,...existingCreates])];
 const actions=patch.changes.map(c=>({kind:c.operation==='delete'?'delete':'write',target:c.path}));
 const review=evaluateAtlasAgentChange({id:proposalId,actions,checks,approval});
 return Object.freeze({
  schemaVersion:2,proposalId,context,impact,patch,review,unresolved,
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
export async function claimAtlasCodingCycleReview({cycle,claim,publicKey,nowMs,directory,authorizeActor,expected}={}){
 if(!cycle||cycle.status!=='planned_not_executed'||cycle.verifiedReady!==false||
    !cycle.review||cycle.unresolved?.length||!cycle.patch||
    typeof cycle.proposalId!=='string'||!expected||
    typeof expected!=='object'||expected.proposalId!==cycle.proposalId)
  throw Error('A complete unresolved-free planned coding cycle is required');
 const {claimAtlasCodingReview}=await import('./atlas-coding-review-claim.mjs');
 if(claim?.proposalId!==cycle.proposalId)
  return Object.freeze({status:'blocked',reason:'proposal_mismatch',authorizationGranted:false,executesCode:false});
 return claimAtlasCodingReview({claim,publicKey,expected,nowMs,directory,authorizeActor});
}
