import {buildAtlasRepoMap,selectAtlasRepoContext,selectAtlasAffectedModules} from './atlas-repo-map.mjs';
import {planAtlasPatch} from './atlas-patch-planner.mjs';
import {evaluateAtlasAgentChange} from './atlas-agent-change-gate.mjs';
import {evaluateAtlasVerifiedChange} from './atlas-verified-evidence-gate.mjs';

/**
 * Atlas coding cycle: deterministic plan -> context -> review gate.
 * This function never executes code, modifies a repository or asserts
 * that checks have actually run.
 */
export function planAtlasCodingCycle({proposalId,repositoryFiles,targets,changes,
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
 const review=evaluateAtlasAgentChange({id:proposalId,actions});
 return Object.freeze({
  schemaVersion:2,proposalId,context,impact,patch,review,unresolved,
  status:'planned_not_executed',
  // The legacy gate remains diagnostic only; its flags are not passed through.
  verifiedReady:false,
  nextStep:unresolved.length?'resolve_missing_or_conflicting_files':'verify_commit_bound_evidence',
 });
}

/**
 * Bind verification to the exact proposal and actions produced by the cycle.
 * The injected verifier must be owned by a trusted host; this never executes,
 * publishes or authorizes a patch.
 */
export async function verifyAtlasCodingCycleEvidence({
 cycle,commitSha,evidence,verifyEvidence
}={}){
 if(!cycle||cycle.schemaVersion!==2||typeof cycle.proposalId!=='string'||
    !cycle.patch||!Array.isArray(cycle.patch.changes)||!Array.isArray(cycle.unresolved))
  throw Error('Invalid coding cycle');
 if(cycle.unresolved.length)throw Error('Cannot verify unresolved coding cycle');
 const actions=cycle.patch.changes.map(change=>({
  kind:change.operation==='delete'?'delete':'write',target:change.path
 }));
 const verification=await evaluateAtlasVerifiedChange({
  proposalId:cycle.proposalId,commitSha,actions,evidence,verifyEvidence
 });
 return Object.freeze({
  ...verification,
  status:'evidence_review_only',
  executionAuthorized:false,
 });
}
