import {assessAtlasAnchoredRestore} from './atlas-anchored-restore-gate.mjs';
import {claimAtlasReviewedRestoreApproval} from './atlas-reviewed-approval-claim.mjs';
import {verifyAtlasRestorePoint} from './atlas-restore-point.mjs';
/**
 * Read-only evidence assessment followed by a one-time approval claim.
 * No Git checkout, reset, deployment or restore execution.
 */
export async function claimAtlasAnchoredRestore({
 entries,anchor,anchorPublicKey,expectedScope,trustedCheckpoint,
 restorePoints,signedApprovals,approvalPublicKey,expectedActorId,
 currentRevision,lookupCommit,authorizeActor,nowMs,directory,
 claimApproval=claimAtlasReviewedRestoreApproval
}={}){
 if(typeof claimApproval!=='function')throw Error('Claim adapter required');
 const reviewed=await assessAtlasAnchoredRestore({
  entries,anchor,anchorPublicKey,expectedScope,trustedCheckpoint,
  restorePoints,signedApprovals,approvalPublicKey,expectedActorId,
  currentRevision,lookupCommit,authorizeActor
 });
 if(reviewed.status!=='ready_for_final_human_review')
  return Object.freeze({status:'blocked',reason:reviewed.reason??'review_not_ready',
   executesRestore:false});
 const matches=restorePoints.filter(point=>{
  verifyAtlasRestorePoint(point);
  return point.historyHeadHash===reviewed.historyHash&&
   point.revision===reviewed.revision&&
   point.config?.modelId===reviewed.candidateId;
 });
 if(matches.length!==1)
  return Object.freeze({status:'blocked',reason:'restore_point_ambiguous',
   executesRestore:false});
 const point=matches[0];
 const matchingApprovals=signedApprovals.filter(approval=>
  approval.historyHash===reviewed.historyHash&&
  approval.restoreChecksum===point.checksum&&
  approval.actorId===expectedActorId);
 if(matchingApprovals.length!==1)
  return Object.freeze({status:'blocked',reason:'approval_ambiguous',
   executesRestore:false});
 const claim=await claimApproval({
  approval:matchingApprovals[0],publicKey:approvalPublicKey,
  expectedActorId,nowMs,directory,authorizeActor,
  expectedHistoryHash:reviewed.historyHash,
  expectedRestoreChecksum:point.checksum
 });
 if(claim.status!=='approval_claimed_for_final_human_review')
  return Object.freeze({status:'blocked',reason:claim.reason??'claim_failed',
   executesRestore:false});
 return Object.freeze({
  status:'approval_claimed_pending_final_human_review',
  approvalId:claim.approvalId,historyHash:reviewed.historyHash,
  signedHistoryHeadHash:reviewed.signedHistoryHeadHash,
  restoreChecksum:point.checksum,revision:reviewed.revision,
  historyContinuityVerified:true,consumptionPersisted:true,
  trustedCheckpointFreshnessVerified:false,
  executesRestore:false,automaticPromotion:false
 });
}
