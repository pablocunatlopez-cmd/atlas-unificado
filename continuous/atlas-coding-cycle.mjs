import {createHash} from 'node:crypto';
import {buildAtlasRepoMap,selectAtlasRepoContext,selectAtlasAffectedModules} from './atlas-repo-map.mjs';
import {planAtlasPatch} from './atlas-patch-planner.mjs';
import {evaluateAtlasVerifiedChange} from './atlas-verified-evidence-gate.mjs';

/**
 * Atlas coding cycle: deterministic plan -> context -> review gate.
 * This function never executes code, modifies a repository or asserts
 * that checks have actually run.
 */
function prepareAtlasCodingCycle({proposalId,repositoryFiles,targets,changes,
 contextLimits={}}={}){
 const repoMap=buildAtlasRepoMap(repositoryFiles);
 const context=selectAtlasRepoContext(repoMap,{targets,...contextLimits});
 const patch=planAtlasPatch({proposalId,files:changes});
 const impact=selectAtlasAffectedModules(repoMap,{targets:patch.changes.map(c=>c.path)});
 const missingReadTargets=context.missingTargets;
 const missingChangeTargets=patch.changes.filter(c=>c.operation!=='create'&&!repoMap.files.some(f=>f.path===c.path)).map(c=>c.path);
 const existingCreates=patch.changes.filter(c=>c.operation==='create'&&repoMap.files.some(f=>f.path===c.path)).map(c=>c.path);
 const unresolved=[...new Set([...missingReadTargets,...missingChangeTargets,...existingCreates])];
 return Object.freeze({
  schemaVersion:3,proposalId,context,impact,patch,unresolved,
  status:'planned_not_executed',
 });
}

/**
 * Host-verified review of an exact patch proposal, not execution permission.
 * The host verifier is responsible for authenticating and binding evidence.
 */
export async function planAtlasCodingCycle({
 proposalId,repositoryFiles,targets,changes,contextLimits,
 commitSha,evidence,verifyEvidence
}={}){
 // Capture the content once; the planner intentionally omits it from its output.
 if(!Array.isArray(changes))throw Error('Invalid patch proposal');
 const captured=changes.map(change=>change&&({
  operation:change.operation,path:change.path,
  ...(change.content===undefined?{}:{content:change.content})
 }));
 const plan=prepareAtlasCodingCycle({
  proposalId,repositoryFiles,targets,changes:captured,contextLimits
 });
 const proposalDigest=createHash('sha256').update(JSON.stringify({
  proposalId,changes:captured
 })).digest('hex');
 const actions=plan.patch.changes.map(c=>({
  kind:c.operation==='delete'?'delete':'write',target:c.path
 }));
 const verifiedReview=await evaluateAtlasVerifiedChange({
  proposalId,commitSha,proposalDigest,actions,evidence,verifyEvidence
 });
 const verifiedReady=plan.unresolved.length===0&&verifiedReview.readyForHumanReview;
 const review=Object.freeze({...verifiedReview,readyForHumanReview:verifiedReady,readyForReview:verifiedReady});
 return Object.freeze({
  ...plan,proposalDigest,review,verifiedReview,verifiedReady,
  executionAuthorized:false,
  nextStep:plan.unresolved.length?'resolve_missing_or_conflicting_files':
   verifiedReady?'human_review':'verify_commit_bound_evidence'
 });
}

export const planAtlasVerifiedCodingCycle=planAtlasCodingCycle;
