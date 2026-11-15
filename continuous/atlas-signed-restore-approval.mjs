import {createPublicKey,verify} from 'node:crypto';
/**
 * Verify an externally signed approval using a trusted Ed25519 public key.
 * Trust in the key owner and their authorization is the host's responsibility.
 * This module does not create approvals, store secrets or execute restores.
 */
const SHA=/^[a-f0-9]{64}$/;
export function atlasApprovalMessage({historyHash,restoreChecksum,approvedAt,actorId}={}){
 if(typeof historyHash!=='string'||!SHA.test(historyHash)||
  typeof restoreChecksum!=='string'||!SHA.test(restoreChecksum)||
  !Number.isSafeInteger(approvedAt)||approvedAt<0||
  typeof actorId!=='string'||!/^[a-zA-Z0-9_.@-]{1,128}$/.test(actorId))
  throw Error('Invalid approval payload');
 return Buffer.from(JSON.stringify({
  domain:'atlas.restore.approval.v1',historyHash,restoreChecksum,
  approvedAt,actorId
 }), 'utf8');
}
export function verifyAtlasSignedApproval({
 approval,publicKey,expectedActorId
}={}){
 if(!approval||typeof approval!=='object'||
  typeof approval.signature!=='string'||
  !/^[A-Za-z0-9+/]+={0,2}$/.test(approval.signature)||
  approval.signature.length>512||
  typeof expectedActorId!=='string'||!expectedActorId||
  approval.actorId!==expectedActorId)
  throw Error('Invalid signed approval');
 const message=atlasApprovalMessage(approval);
 const key=createPublicKey(publicKey);
 if(key.asymmetricKeyType!=='ed25519')
  throw Error('Ed25519 key required');
 const signature=Buffer.from(approval.signature,'base64');
 if(signature.length!==64||!verify(null,message,key,signature))
  throw Error('Approval signature invalid');
 return Object.freeze({
  historyHash:approval.historyHash,restoreChecksum:approval.restoreChecksum,
  actorId:approval.actorId,approvedAt:approval.approvedAt,
  signatureVerified:true,actorAuthorized:'host_must_verify'
 });
}
