import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const SHA=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const DIGEST=/^[a-f0-9]{64}$/;
/**
 * Read-only recovery report. An intent marker is not proof of a commit.
 * Never automatically retries, deletes markers, or authorizes writes.
 */
export async function reconcileAtlasCodingIntent({directory,transactionId,readHeadCommit,expectedProposalId,expectedBaseCommit,expectedDiffDigest}={}){
 if(typeof directory!=='string'||!directory.trim()||!ID.test(transactionId||'')||
    typeof readHeadCommit!=='function')
  throw Error('Trusted coding reconciliation context required');
 const info=await stat(directory);
 if(!info.isDirectory()||(info.mode&0o077)!==0)
  throw Error('Coding intent directory must be private');
 let raw;
 try{raw=await readFile(join(directory,transactionId+'.intent.json'),'utf8');}
 catch(e){
  if(e?.code==='ENOENT')return Object.freeze({status:'intent_not_found',retrySafe:false,action:'manual_review'});
  throw e;
 }
 let record;
 try{record=JSON.parse(raw);}
 catch{return Object.freeze({status:'corrupt_or_partial_intent',retrySafe:false,action:'manual_review'});}
 if(!record||record.schemaVersion!==1||record.transactionId!==transactionId||
    !ID.test(record.proposalId||'')||!SHA.test(record.baseCommit||'')||
    !DIGEST.test(record.diffDigest||'')||record.status!=='intent_recorded_no_commit_claim')
  return Object.freeze({status:'invalid_intent',retrySafe:false,action:'manual_review'});
 if(expectedProposalId!==undefined&&record.proposalId!==expectedProposalId)
  return Object.freeze({status:'proposal_id_mismatch',retrySafe:false,action:'manual_review'});
 if(expectedBaseCommit!==undefined&&record.baseCommit!==expectedBaseCommit)
  return Object.freeze({status:'base_commit_mismatch',retrySafe:false,action:'manual_review'});
 if(expectedDiffDigest!==undefined&&record.diffDigest!==expectedDiffDigest)
  return Object.freeze({status:'diff_digest_mismatch',retrySafe:false,action:'manual_review'});
 const head=await readHeadCommit();
 if(head===record.baseCommit)
  return Object.freeze({status:'base_still_visible',transactionId,retrySafe:false,
   action:'inspect_host_transaction_log'});
 return Object.freeze({status:'head_changed_since_intent',transactionId,retrySafe:false,
  action:'inspect_diff_and_host_transaction_log'});
}
