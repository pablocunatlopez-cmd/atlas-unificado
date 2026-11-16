import {mkdir,open,stat,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {constants} from 'node:fs';
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const SHA=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const DIGEST=/^[a-f0-9]{64}$/;
/**
 * Private local append-only intent markers. The host must coordinate all
 * writers, and must not mistake this for a distributed transaction log.
 * Never records secrets, patch contents, or authorization tokens.
 */
export async function recordAtlasCodingIntent({directory,transactionId,proposalId,
 baseCommit,diffDigest}={}){
 if(typeof directory!=='string'||!directory.trim()||!ID.test(transactionId||'')||
    !ID.test(proposalId||'')||!SHA.test(baseCommit||'')||!DIGEST.test(diffDigest||''))
  throw Error('Invalid coding transaction intent');
 await mkdir(directory,{recursive:true,mode:0o700});
 const info=await lstat(directory);
 if(!info.isDirectory()||(info.mode&0o077)!==0)
  throw Error('Coding intent directory must be private (0700)');
 const path=join(directory,transactionId+'.intent.json');
 const entry={schemaVersion:1,transactionId,proposalId,baseCommit,diffDigest,
  status:'intent_recorded_no_commit_claim'};
 let handle;
 try{
  handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  await handle.writeFile(JSON.stringify(entry)+'\n','utf8');
  await handle.sync();
 }catch(error){
  if(error?.code==='EEXIST'){
   let existing;
   try{
    const existingInfo=await lstat(path);
    if(!existingInfo.isFile()||(existingInfo.mode&0o077)!==0)
     return Object.freeze({status:'unsafe_intent_file',transactionId,applied:false});
    const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{existing=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
   }
   catch{return Object.freeze({status:'corrupt_or_partial_intent',transactionId,applied:false});}
   if(existing.transactionId===transactionId&&existing.proposalId===proposalId&&
      existing.baseCommit===baseCommit&&existing.diffDigest===diffDigest)
    return Object.freeze({status:'already_recorded',transactionId,applied:false});
   return Object.freeze({status:'transaction_id_conflict',transactionId,applied:false});
  }
  throw error;
 }finally{await handle?.close();}
 const dir=await open(directory,'r');
 try{await dir.sync();}finally{await dir.close();}
 return Object.freeze({status:'intent_recorded',transactionId,applied:false});
}
