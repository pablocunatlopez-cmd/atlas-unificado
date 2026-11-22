import {assessAtlasApprovalReplay} from './atlas-restore-approval-replay-gate.mjs';
import {consumeAtlasApprovalOnce} from './atlas-approval-consumption-store.mjs';
/**
 * Fail-closed local approval claim for a human-reviewed restore proposal.
 * Signature, age and host authorization are checked before single-use claim.
 * Claiming an approval is NOT permission to execute a restore.
 * The host owns clock, keys, actor authorization and storage directory.
 */
export async function claimAtlasReviewedRestoreApproval({
 approval,publicKey,expectedActorId,nowMs,directory,
 authorizeActor,expectedHistoryHash,expectedRestoreChecksum,
 maxAgeMs=300000,maxFutureSkewMs=30000,
 consume=consumeAtlasApprovalOnce
}={}){
 if(typeof authorizeActor!=='function'||typeof consume!=='function'||
  typeof expectedHistoryHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHistoryHash)||
  typeof expectedRestoreChecksum!=='string'||!/^[a-f0-9]{64}$/.test(expectedRestoreChecksum))
  throw Error('Trusted restore claim context required');
 const checked=assessAtlasApprovalReplay({
  approval,publicKey,expectedActorId,consumedApprovalIds:[],
  nowMs,maxAgeMs,maxFutureSkewMs
 });
 if(checked.status!=='eligible_for_atomic_host_consumption')
  return Object.freeze({status:'blocked',reason:checked.reason,executesRestore:false});
 if(checked.historyHash!==expectedHistoryHash||
  checked.restoreChecksum!==expectedRestoreChecksum)
  return Object.freeze({status:'blocked',reason:'approval_target_mismatch',executesRestore:false});
 const authorized=await authorizeActor({
  actorId:checked.actorId,operation:'restore_approval_claim',
  historyHash:checked.historyHash,restoreChecksum:checked.restoreChecksum
 });
 if(authorized!==true)
  return Object.freeze({status:'blocked',reason:'actor_not_authorized',executesRestore:false});
 const result=await consume({directory,approvalId:checked.approvalId,
  metadata:{actorId:checked.actorId,historyHash:checked.historyHash,
   restoreChecksum:checked.restoreChecksum}});
 if(result.status!=='consumed'||result.consumed!==true)
  return Object.freeze({status:'blocked',reason:'approval_already_consumed',
   approvalId:checked.approvalId,executesRestore:false});
 return Object.freeze({
  status:'approval_claimed_for_final_human_review',
  approvalId:checked.approvalId,consumptionPersisted:true,
  signatureVerified:true,hostAuthorizationChecked:true,
  executesRestore:false,automaticPromotion:false,
  note:'No checkout or restore; a separate final human review is mandatory'
 });
}
