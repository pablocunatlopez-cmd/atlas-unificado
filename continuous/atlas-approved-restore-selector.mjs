import {verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {verifyAtlasRestorePoint,planAtlasRestore} from './atlas-restore-point.mjs';
/**
 * Find the most recent explicitly human-approved candidate whose recorded
 * A/B recommendation was eligible. Never infers approval from A/B results.
 * No Git operations or restore execution.
 */
export function selectAtlasApprovedRestore({
 entries,restorePoints,approvals,currentRevision
}={}){
 verifyAtlasEvaluationHistory(entries);
 if(!Array.isArray(restorePoints)||restorePoints.length>1000||
  !Array.isArray(approvals)||approvals.length>1000)
  throw Error('Invalid restore selection');
 const approved=new Map();
 for(const item of approvals){
  if(!item||typeof item.historyHash!=='string'||
   !/^[a-f0-9]{64}$/.test(item.historyHash)||
   typeof item.restoreChecksum!=='string'||
   !/^[a-f0-9]{64}$/.test(item.restoreChecksum)||
   item.approved!==true||approved.has(item.historyHash))
   throw Error('Invalid approval evidence');
  approved.set(item.historyHash,item.restoreChecksum);
 }
 const points=new Map();
 for(const point of restorePoints){
  verifyAtlasRestorePoint(point);
  if(points.has(point.checksum))throw Error('Duplicate restore point');
  points.set(point.checksum,point);
 }
 for(let i=entries.length-1;i>=0;i--){
  const entry=entries[i];
  if(entry.data.recommendation!=='eligible_for_human_review')continue;
  const checksum=approved.get(entry.hash);
  if(!checksum)continue;
  const point=points.get(checksum);
  if(!point||point.historyHeadHash!==entry.hash)continue;
  if(point.config?.modelId!==entry.data.candidateId)continue;
  const plan=planAtlasRestore({point,currentRevision,approved:false});
  return Object.freeze({
   status:'candidate_for_manual_restore',
   evaluationSequence:entry.sequence,evaluationHash:entry.hash,
   candidateId:entry.data.candidateId,plan,
   approvalEvidence:'caller_supplied_unverified',
   requiresHumanConfirmation:true,executesRestore:false
  });
 }
 return Object.freeze({status:'no_eligible_approved_restore',
  requiresHumanConfirmation:true,executesRestore:false});
}
