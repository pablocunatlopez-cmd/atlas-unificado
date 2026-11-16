/**
 * Read-only recovery classifier after an ambiguous host commit outcome.
 * It does not retry writes or assert that a transaction was atomic.
 */
export async function inspectAtlasCodingCommitRecovery({
 expectedBaseCommit,expectedNewCommit,readHeadCommit
}={}){
 const valid=x=>typeof x==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(x);
 if(!valid(expectedBaseCommit)||!valid(expectedNewCommit)||
    expectedBaseCommit===expectedNewCommit||typeof readHeadCommit!=='function')
  throw Error('Trusted commit recovery context required');
 const head=await readHeadCommit();
 if(head===expectedNewCommit)
  return Object.freeze({status:'new_commit_visible',retrySafe:false,action:'verify_diff_and_audit'});
 if(head===expectedBaseCommit)
  return Object.freeze({status:'base_commit_visible',retrySafe:false,action:'inspect_transaction_log_before_retry'});
 return Object.freeze({status:'unexpected_head',retrySafe:false,action:'manual_reconciliation_required'});
}
