import {verifyAtlasHistoryAnchor} from './atlas-history-signed-anchor.mjs';
import {verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
/**
 * Prevent rollback to an older valid signed head by requiring a trusted
 * independently retained checkpoint. Both keys and checkpoint must come
 * from the host, never from the candidate history or its directory.
 * Does not establish signer authorization or wall-clock freshness.
 */
export function verifyAtlasHistoryContinuity({
 entries,anchor,publicKey,expectedScope,trustedCheckpoint
}={}){
 const signed=verifyAtlasHistoryAnchor({
  entries,anchor,publicKey,expectedScope
 });
 if(!trustedCheckpoint||typeof trustedCheckpoint!=='object'||
  !Number.isSafeInteger(trustedCheckpoint.count)||
  trustedCheckpoint.count<1||trustedCheckpoint.count>1000||
  typeof trustedCheckpoint.headHash!=='string'||
  !/^[a-f0-9]{64}$/.test(trustedCheckpoint.headHash)||
  trustedCheckpoint.scope!==expectedScope)
  throw Error('Trusted checkpoint required');
 if(entries.length<trustedCheckpoint.count)
  throw Error('History rollback detected');
 const prefix=verifyAtlasEvaluationHistory(
  entries.slice(0,trustedCheckpoint.count)
 );
 if(prefix.headHash!==trustedCheckpoint.headHash)
  throw Error('History diverges from trusted checkpoint');
 return Object.freeze({
  status:'signed_history_extends_trusted_checkpoint',
  headHash:signed.headHash,count:signed.count,
  checkpointCount:trustedCheckpoint.count,
  checkpointHeadHash:trustedCheckpoint.headHash,
  signatureVerified:true,continuityVerified:true,
  trustedCheckpointProvidedByHost:true,
  signerAuthorizationVerified:false,
  checkpointFreshnessVerified:false,
  automaticPromotion:false
 });
}
