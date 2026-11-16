import {consumeAtlasApprovalOnce} from './atlas-approval-consumption-store.mjs';
import {verifyAtlasCodingApproval} from './atlas-coding-approval-verifier.mjs';
/**
 * Trusted-host adapter for coding approval verification.
 * Never executes code, merges, deploys, or marks a patch as approved.
 * A private local directory is required; not a distributed replay store.
 */
export async function claimAtlasCodingReview({
 claim,publicKey,expected,nowMs,directory,authorizeActor,
 consume=consumeAtlasApprovalOnce
}={}){
 if(typeof directory!=='string'||!directory.trim()||
    typeof consume!=='function'||typeof authorizeActor!=='function')
   throw Error('Trusted coding review host required');
 const result=await verifyAtlasCodingApproval({
  claim,publicKey,expected,nowMs,authorizeActor,
  consumeNonce:async ({nonce,actorId,proposalId,baseCommit,diffDigest})=>{
   const outcome=await consume({directory,approvalId:nonce,
    metadata:{actorId,proposalId,baseCommit,diffDigest}});
   return outcome.status==='consumed'&&outcome.consumed===true;
  }
 });
 return Object.freeze({...result,executesCode:false,authorizationGranted:false});
}
