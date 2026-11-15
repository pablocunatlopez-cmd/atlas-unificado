/**
 * Read-only revision existence check. The trusted host injects a Git adapter.
 * Never checks out, resets, writes, deploys or promotes a revision.
 */
export async function verifyAtlasRestoreRevision({
 revision,lookupCommit
}={}){
 if(typeof revision!=='string'||!/^[a-f0-9]{40}$/.test(revision)||
  typeof lookupCommit!=='function')
  throw Error('Invalid Git revision verification');
 const commit=await lookupCommit(revision);
 if(!commit||typeof commit.sha!=='string'||
  commit.sha.toLowerCase()!==revision)
  return Object.freeze({revision,exists:false,verified:false});
 return Object.freeze({revision,exists:true,verified:true,
  note:'Commit exists according to injected Git adapter; provenance and authorization require separate checks'});
}
