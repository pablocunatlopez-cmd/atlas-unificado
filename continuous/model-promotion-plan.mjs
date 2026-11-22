/**
 * Safety-first promotion protocol inspired by Aider's Git workflow and
 * OpenHands' separation of agent runtime from approval/deployment.
 * This module only creates a plan; it never edits files or deploys models.
 */
export function createPromotionPlan({candidate,ranking,baselineRevision,benchmarkRevision,approval=false}={}){
 if(typeof candidate!=='string'||!candidate.trim()||candidate.length>128)throw Error('Invalid candidate');
 if(typeof baselineRevision!=='string'||!/^[a-f0-9]{40}$/.test(baselineRevision))throw Error('Invalid baseline revision');
 if(typeof benchmarkRevision!=='string'||!/^[a-f0-9]{40}$/.test(benchmarkRevision))throw Error('Invalid benchmark revision');
 if(!ranking||!Array.isArray(ranking.results))throw Error('Missing benchmark ranking');
 const selected=ranking.results.find(item=>item.name===candidate);
 if(!selected||selected.accepted!==true||ranking.recommended!==candidate)
   return {ready:false,reason:'candidate_not_recommended',candidate,actions:[]};
 if(approval!==true)
   return {ready:false,reason:'human_approval_required',candidate,actions:[]};
 return {ready:true,reason:'review_ready',candidate,baselineRevision,benchmarkRevision,
   actions:['snapshot_current_model_config','verify_revisions_unchanged','stage_candidate_without_activation',
     'run_smoke_tests','require_explicit_deployment_confirmation','preserve_rollback_snapshot']};
}
