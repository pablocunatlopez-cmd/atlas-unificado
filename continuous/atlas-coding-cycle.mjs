import {buildAtlasRepoMap,selectAtlasRepoContext} from './atlas-repo-map.mjs';
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
 const actions=patch.changes.map(c=>({kind:c.operation==='delete'?'delete':'write',target:c.path}));
 const review=evaluateAtlasAgentChange({id:proposalId,actions,checks,approval});
 return Object.freeze({
  schemaVersion:1,proposalId,context,patch,review,
  status:'planned_not_executed',
  nextStep:review.failedChecks.length?'run_tests_in_trusted_executor':
    !review.readyForReview?'obtain_host_verified_approval':'human_review',
 });
}
