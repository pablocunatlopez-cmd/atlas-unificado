import {selectAtlasApprovedRestore} from './atlas-approved-restore-selector.mjs';
import {verifyAtlasSignedApproval} from './atlas-signed-restore-approval.mjs';
import {verifyAtlasRestoreRevision} from './atlas-restore-revision-check.mjs';
/**
 * End-to-end READ-ONLY restore evidence gate.
 * Host owns trust in the key and actor authorization.
 * A passing gate is never permission to checkout or deploy.
 */
export async function assessAtlasRestoreSafety({
 entries,restorePoints,signedApprovals,publicKey,expectedActorId,
 currentRevision,lookupCommit
}={}){
 if(!Array.isArray(signedApprovals)||signedApprovals.length>1000||
  typeof lookupCommit!=='function')throw Error('Invalid restore gate inputs');
 const approvals=signedApprovals.map(approval=>{
  const evidence=verifyAtlasSignedApproval({
   approval,publicKey,expectedActorId});
  return {historyHash:evidence.historyHash,
   restoreChecksum:evidence.restoreChecksum,approved:true};
 });
 const selected=selectAtlasApprovedRestore({
  entries,restorePoints,approvals,currentRevision});
 if(selected.status!=='candidate_for_manual_restore')
  return Object.freeze({status:'blocked',reason:'no_approved_candidate',
   executesRestore:false});
 const revision=await verifyAtlasRestoreRevision({
  revision:selected.plan.toRevision,lookupCommit});
 if(!revision.verified)
  return Object.freeze({status:'blocked',reason:'revision_not_verified',
   executesRestore:false});
 return Object.freeze({
  status:'ready_for_additional_human_review',candidateId:selected.candidateId,
  revision:revision.revision,historyHash:selected.evaluationHash,
  approvalSignatureVerified:true,
  actorAuthorizationVerified:false,
  trustedHistoryAnchorVerified:false,
  executesRestore:false,
  note:'Requires trusted key ownership, actor authorization and external history anchor verification'
 });
}
