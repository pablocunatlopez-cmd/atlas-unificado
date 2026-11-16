/**
 * Host-side atomic compare-and-swap adapter.
 * This module does not execute commands, write files or publish branches.
 * Only a trusted host callback can commit; it must be atomic with HEAD
 * comparison and enforce authorization within the same transaction.
 */
export async function applyAtlasCodingPatchCAS({
 expectedBaseCommit,diffDigest,authorization,atomicCommit
}={}){
 if(typeof expectedBaseCommit!=='string'||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expectedBaseCommit)||
    typeof diffDigest!=='string'||!/^[a-f0-9]{64}$/.test(diffDigest)||
    !authorization||authorization.authorized!==true||
    authorization.proposalId===undefined||
    authorization.baseCommit!==expectedBaseCommit||
    authorization.diffDigest!==diffDigest||
    typeof atomicCommit!=='function')
  return Object.freeze({status:'blocked',reason:'missing_trusted_authorization_or_cas',applied:false});
 const result=await atomicCommit({expectedBaseCommit,diffDigest,proposalId:authorization.proposalId});
 if(!result||result.committed!==true||
    typeof result.newCommit!=='string'||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(result.newCommit))
  return Object.freeze({status:'blocked',reason:'cas_not_confirmed',applied:false});
 return Object.freeze({status:'host_reported_committed',applied:true,newCommit:result.newCommit,
  note:'Trust in commit and authorization depends on the host atomic transaction'});
}
