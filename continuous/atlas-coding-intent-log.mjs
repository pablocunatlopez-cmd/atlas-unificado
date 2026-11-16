import {mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
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
 const path=join(directory,transactionId+'.intent.json');
 const entry={schemaVersion:1,transactionId,proposalId,baseCommit,diffDigest,
  status:'intent_recorded_no_commit_claim'};
 let handle;
 try{
  handle=await open(path,'wx',0o600);
  await handle.writeFile(JSON.stringify(entry)+'\n','utf8');
  await handle.sync();
 }catch(error){
  if(error?.code==='EEXIST'){
   const existing=JSON.parse(await readFile(path,'utf8'));
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
