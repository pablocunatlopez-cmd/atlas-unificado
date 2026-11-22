import {createHash} from 'node:crypto';
import {verifyAtlasSignedApproval} from './atlas-signed-restore-approval.mjs';
/**
 * Replay protection for a signed restore approval. Host supplies the
 * authoritative consumed-ID set and must atomically persist consumption.
 * This gate does not mutate the set or execute a restore.
 */
export function assessAtlasApprovalReplay({
 approval,publicKey,expectedActorId,consumedApprovalIds,
 nowMs,maxAgeMs=300000,maxFutureSkewMs=30000
}={}){
 const verified=verifyAtlasSignedApproval({approval,publicKey,expectedActorId});
 if(!Number.isSafeInteger(nowMs)||nowMs<0||
  !Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>86400000||
  !Number.isSafeInteger(maxFutureSkewMs)||maxFutureSkewMs<0||
  maxFutureSkewMs>300000||
  !Array.isArray(consumedApprovalIds)||consumedApprovalIds.length>10000||
  consumedApprovalIds.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)))
  throw Error('Invalid trusted replay context');
 const approvalId=createHash('sha256').update(JSON.stringify({
  domain:'atlas.restore.approval.replay.v1',
  actorId:verified.actorId,historyHash:verified.historyHash,
  restoreChecksum:verified.restoreChecksum,
  approvedAt:verified.approvedAt,signature:approval.signature
 })).digest('hex');
 if(consumedApprovalIds.includes(approvalId))
  return Object.freeze({status:'blocked',reason:'approval_already_consumed',
   approvalId,executesRestore:false});
 if(verified.approvedAt>nowMs+maxFutureSkewMs)
  return Object.freeze({status:'blocked',reason:'approval_from_future',
   approvalId,executesRestore:false});
 if(nowMs-verified.approvedAt>maxAgeMs)
  return Object.freeze({status:'blocked',reason:'approval_expired',
   approvalId,executesRestore:false});
 return Object.freeze({
  status:'eligible_for_atomic_host_consumption',approvalId,
  actorId:verified.actorId,historyHash:verified.historyHash,
  restoreChecksum:verified.restoreChecksum,
  signatureVerified:true,authorizationVerified:false,
  clockTrusted:'host_responsibility',
  consumptionPersisted:false,executesRestore:false,
  note:'Host must atomically mark approvalId consumed before allowing any action'
 });
}
