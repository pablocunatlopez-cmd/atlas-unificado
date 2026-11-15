import {appendAtlasEvaluationHistory,verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {createAtlasRestorePoint} from './atlas-restore-point.mjs';
import {assessAtlasPatchCandidate} from './atlas-patch-ab-review-gate.mjs';
/**
 * Pure, human-reviewed record preparation. No disk write, Git checkout,
 * deployment, promotion or trusted-history attestation.
 */
export function recordAtlasPatchEvaluation({
 entries=[],patchReport,abReport,baselineId,candidateId,
 timestamp,revision,config
}={}){
 const existing=verifyAtlasEvaluationHistory(entries);
 if(typeof revision!=='string'||!/^[a-f0-9]{40}$/.test(revision)||
  !config||typeof config!=='object'||Array.isArray(config)||
  patchReport?.evidence?.baseRevision!==revision)
  throw Error('Patch revision or restore configuration invalid');
 const assessment=assessAtlasPatchCandidate({
  patchReport,abReport,baselineId,candidateId
 });
 const nextEntries=appendAtlasEvaluationHistory({
  entries,record:assessment.record,timestamp
 });
 const nextHead=nextEntries.at(-1).hash;
 const restorePoint=createAtlasRestorePoint({
  revision,config,historyHeadHash:nextHead,createdAt:timestamp
 });
 return Object.freeze({
  status:assessment.status,assessment,
  entries:nextEntries,previousHeadHash:existing.headHash,
  headHash:nextHead,restorePoint,
  persistenceRequired:true,trustedAnchorVerified:false,
  revisionExistsVerified:false,automaticPromotion:false,
  executesRestore:false,requiresHumanReview:true,
  note:'Restore point identifies the supplied base revision, not an automatically validated candidate build'
 });
}
