import {recordAtlasCodingIntent} from './atlas-coding-intent-log.mjs';
import {applyAtlasCodingPatchCAS} from './atlas-coding-atomic-commit.mjs';
/**
 * Conservative single-attempt host orchestrator.
 * Intent is durable before the host callback. Any duplicate intent is
 * blocked, including one with matching parameters, until reconciled.
 * Host must implement atomic compare-and-swap and independent authorization.
 */
export async function attemptAtlasCodingCommit({
 directory,transactionId,proposalId,expectedBaseCommit,diffDigest,
 authorization,verifyAuthorization,atomicCommit
}={}){
 if(typeof verifyAuthorization!=='function'||typeof atomicCommit!=='function')
  return Object.freeze({status:'blocked',reason:'trusted_host_required',applied:false});
 if(!authorization||authorization.authorized!==true||
    authorization.proposalId!==proposalId||
    authorization.baseCommit!==expectedBaseCommit||
    authorization.diffDigest!==diffDigest)
  return Object.freeze({status:'blocked',reason:'authorization_mismatch',applied:false});
 // Verify before recording an intent, then reverify in the atomic host transaction.
 if(await verifyAuthorization({authorization,expectedBaseCommit,diffDigest})!==true)
  return Object.freeze({status:'blocked',reason:'host_authorization_rejected',applied:false});
 const intent=await recordAtlasCodingIntent({directory,transactionId,proposalId,
  baseCommit:expectedBaseCommit,diffDigest});
 if(intent.status!=='intent_recorded')
  return Object.freeze({status:'blocked',reason:intent.status,applied:false});
 try{
  return await applyAtlasCodingPatchCAS({expectedBaseCommit,diffDigest,
   authorization,verifyAuthorization,atomicCommit});
 }catch(error){
  return Object.freeze({status:'outcome_unknown',reason:'host_callback_failed',
   applied:false,retrySafe:false,transactionId});
 }
}
