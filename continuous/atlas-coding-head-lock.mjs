/**
 * Serializes a final host-side compare-and-swap decision for one repository.
 * The caller MUST supply a lock that is shared by all writers and a trusted
 * HEAD reader. This does not execute or publish any patch.
 */
export async function verifyAtlasCodingHeadUnderLock({
 expectedBaseCommit,readHeadCommit,withRepositoryLock
}={}){
 if(typeof expectedBaseCommit!=='string'||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expectedBaseCommit)||
    typeof readHeadCommit!=='function'||
    typeof withRepositoryLock!=='function')
  throw Error('Trusted repository lock and HEAD reader required');
 return withRepositoryLock(async()=>{
  const head=await readHeadCommit();
  if(head!==expectedBaseCommit)
   return Object.freeze({status:'blocked',reason:'stale_base_commit',executesCode:false});
  return Object.freeze({status:'head_matches_under_lock',executesCode:false,
   note:'Host must keep this same lock until atomic write or CAS completes'});
 });
}
