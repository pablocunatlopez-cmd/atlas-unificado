import {readAtlasEvaluationHistoryFile,writeAtlasEvaluationHistoryFile} from './atlas-evaluation-history-store.mjs';
import {verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {verifyAtlasRestoreRevision} from './atlas-restore-revision-check.mjs';
import {recordAtlasPatchEvaluation} from './atlas-patch-evaluation-record.mjs';
/**
 * Explicit local persistence of a reviewed patch evaluation. The injected
 * Git lookup is read-only. A separate trusted history anchor is still needed.
 * Not interprocess atomic; caller must serialize writers and secure file path.
 */
export async function persistAtlasPatchEvaluation({
 filePath,patchReport,abReport,baselineId,candidateId,
 timestamp,revision,config,lookupCommit,
 readHistory=readAtlasEvaluationHistoryFile,
 writeHistory=writeAtlasEvaluationHistoryFile
}={}){
 if(typeof lookupCommit!=='function'||typeof readHistory!=='function'||
  typeof writeHistory!=='function')
  throw Error('Trusted persistence adapters required');
 const revisionCheck=await verifyAtlasRestoreRevision({revision,lookupCommit});
 if(!revisionCheck.verified)
  return Object.freeze({status:'blocked_unverified_revision',
   persisted:false,automaticPromotion:false,executesRestore:false});
 const current=await readHistory({filePath});
 const head=verifyAtlasEvaluationHistory(current.entries).headHash;
 const prepared=recordAtlasPatchEvaluation({
  entries:current.entries,patchReport,abReport,baselineId,candidateId,
  timestamp,revision,config
 });
 const saved=await writeHistory({
  filePath,entries:prepared.entries,expectedHeadHash:head
 });
 if(saved.headHash!==prepared.headHash||saved.count!==prepared.entries.length)
  throw Error('Persistence result does not match prepared history');
 return Object.freeze({
  status:'recorded_for_human_review',persisted:true,
  headHash:prepared.headHash,previousHeadHash:head,
  restorePoint:prepared.restorePoint,assessment:prepared.assessment,
  revisionExistsVerified:true,trustedHistoryAnchorVerified:false,
  automaticPromotion:false,executesRestore:false,
  note:'Host must independently anchor the head hash and authorize any restore'
 });
}
