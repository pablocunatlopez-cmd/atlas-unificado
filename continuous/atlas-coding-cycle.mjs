import {buildAtlasRepoMap,selectAtlasRepoContext,selectAtlasAffectedModules} from './atlas-repo-map.mjs';
import {planAtlasPatch} from './atlas-patch-planner.mjs';
import {evaluateAtlasAgentChange} from './atlas-agent-change-gate.mjs';
import {evaluateAtlasVerifiedChange} from './atlas-verified-evidence-gate.mjs';

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
 * Plan and review commit-bound evidence without executing or publishing a change.
 * The verifier must be provided by the trusted host, not by the proposal author.
 */
export async function reviewAtlasCodingCycle({commitSha,evidence,verifyEvidence,...proposal}={}){
 const plan=planAtlasCodingCycle(proposal);
 if(plan.unresolved.length)throw Error('Resolve missing or conflicting files before evidence review');
 const actions=Object.freeze(plan.patch.changes.map(c=>Object.freeze({
  kind:c.operation==='delete'?'delete':'write',target:c.path,
 })));
 const evidenceReview=await evaluateAtlasVerifiedChange({
  proposalId:plan.proposalId,commitSha,actions,evidence,verifyEvidence,
 });
 return Object.freeze({plan,evidenceReview,executionAuthorized:false});
}
