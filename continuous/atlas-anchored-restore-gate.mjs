import {verifyAtlasHistoryContinuity} from './atlas-history-continuity-gate.mjs';
import {assessAtlasRestoreSafety} from './atlas-restore-safety-gate.mjs';
/**
 * Compose independent history and restore evidence gates. No checkout,
 * deployment or authority delegation. Host must supply trusted keys and
 * checkpoint from outside the evaluated history.
 */
export async function assessAtlasAnchoredRestore({
 entries,anchor,anchorPublicKey,expectedScope,trustedCheckpoint,
 restorePoints,signedApprovals,approvalPublicKey,expectedActorId,
 currentRevision,lookupCommit,authorizeActor
}={}){
 const history=verifyAtlasHistoryContinuity({
  entries,anchor,publicKey:anchorPublicKey,expectedScope,trustedCheckpoint
 });
 if(typeof authorizeActor!=='function')
  throw Error('Host actor authorization callback required');
 const authorized=await authorizeActor({
  actorId:expectedActorId,operation:'restore_review',
  scope:expectedScope,historyHeadHash:history.headHash
 });
 if(authorized!==true)
  return Object.freeze({status:'blocked',reason:'actor_not_authorized',
   historyContinuityVerified:true,executesRestore:false});
 const restore=await assessAtlasRestoreSafety({
  entries,restorePoints,signedApprovals,
  publicKey:approvalPublicKey,expectedActorId,currentRevision,lookupCommit
 });
 if(restore.status!=='ready_for_additional_human_review')
  return Object.freeze({status:'blocked',reason:restore.reason??'restore_gate_blocked',
   historyContinuityVerified:true,actorAuthorizationChecked:true,
   executesRestore:false});
 return Object.freeze({
  status:'ready_for_final_human_review',
  candidateId:restore.candidateId,revision:restore.revision,
  historyHash:restore.historyHash,
  signedHistoryHeadHash:history.headHash,
  historyContinuityVerified:true,approvalSignatureVerified:true,
  actorAuthorizationChecked:true,
  actorAuthorizationSource:'caller_supplied_host_callback',
  trustedCheckpointFreshnessVerified:false,
  executesRestore:false,automaticPromotion:false,
  note:'No restore execution. Host must validate key provenance, checkpoint freshness and final human approval'
 });
}
