import {open,unlink,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readAtlasEvaluationHistoryFile,writeAtlasEvaluationHistoryFile} from './atlas-evaluation-history-store.mjs';
import {verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
/**
 * Cooperative, fail-closed exclusive lock for a trusted local directory.
 * Does not remove stale locks automatically. Not safe against hostile local
 * users, symlink races, NFS or non-cooperating writers.
 */
export async function appendAtlasHistoryWithLock({
 filePath,expectedHeadHash,buildEntries,
 readHistory=readAtlasEvaluationHistoryFile,
 writeHistory=writeAtlasEvaluationHistoryFile
}={}){
 if(typeof filePath!=='string'||!filePath.trim()||
  (expectedHeadHash!==null&&
   (typeof expectedHeadHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHeadHash)))||
  typeof buildEntries!=='function')
  throw Error('Invalid locked history request');
 const destination=resolve(filePath);
 const lockPath=destination+'.lock';
 let handle;
 try{
  handle=await open(lockPath,'wx',0o600);
 }catch(error){
  if(error?.code==='EEXIST')throw Error('History locked by another writer');
  throw error;
 }
 try{
  const current=await readHistory({filePath:destination});
  const head=verifyAtlasEvaluationHistory(current.entries).headHash;
  if(head!==expectedHeadHash)throw Error('History head changed');
  const next=await buildEntries(Object.freeze([...current.entries]));
  const verified=verifyAtlasEvaluationHistory(next);
  if(next.length!==current.entries.length+1||
   next.at(-1).previousHash!==head)
   throw Error('History append must extend existing head');
  const result=await writeHistory({
   filePath:destination,entries:next,expectedHeadHash:head
  });
  if(result.headHash!==verified.headHash||
   result.count!==next.length)
   throw Error('History persistence confirmation mismatch');
  return Object.freeze({status:'appended_under_cooperative_lock',
   headHash:verified.headHash,count:next.length,
   trustedAnchorVerified:false,lockPath,
   automaticPromotion:false});
 }finally{
  await handle.close();
  await unlink(lockPath);
 }
}
