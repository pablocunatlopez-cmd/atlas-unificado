import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/**
 * Bind a reported patch test to a model A/B result for human review.
 * Neither evidence source is independently attested; this is NOT promotion.
 */
export function assessAtlasPatchCandidate({
 patchReport,abReport,baselineId,candidateId
}={}){
 if(!patchReport||!patchReport.evidence||
  !['tests_reported_passed','tests_reported_failed'].includes(patchReport.status)||
  !abReport||abReport.status!=='completed'||
  !['eligible_for_human_review','reject_candidate'].includes(abReport.recommendation)||
  typeof baselineId!=='string'||!baselineId.trim()||baselineId.length>100||
  typeof candidateId!=='string'||!candidateId.trim()||candidateId.length>100)
  throw Error('Invalid patch candidate evidence');
 const {evidence}=patchReport;
 const {evidenceHash,...data}=evidence;
 if(typeof evidenceHash!=='string'||sha(data)!==evidenceHash||
  typeof evidence.manifestHash!=='string'||
  !/^[a-f0-9]{64}$/.test(evidence.manifestHash)||
  !/^[a-f0-9]{40}$/.test(evidence.baseRevision)||
  !Array.isArray(evidence.changes)||
  evidence.sandboxAttested!==false||
  patchReport.readyToMerge!==false||
  patchReport.originalRepositoryModified!==false||
  (patchReport.status==='tests_reported_passed')!==(evidence.testStatus==='passed')||
  !Number.isFinite(abReport.qualityDelta)||
  !Number.isFinite(abReport.baselineLatencyMs)||
  !Number.isFinite(abReport.candidateLatencyMs)||
  !Array.isArray(abReport.newFailures)||
  typeof abReport.latencyWithinLimit!=='boolean')
  throw Error('Inconsistent patch candidate evidence');
 const testsPassed=patchReport.status==='tests_reported_passed'&&
  evidence.exitCode===0&&evidence.timedOut===false&&
  evidence.outputTruncated===false;
 const abEligible=abReport.recommendation==='eligible_for_human_review'&&
  abReport.newFailures.length===0&&abReport.latencyWithinLimit;
 const record=Object.freeze({
  baselineId,candidateId,
  recommendation:testsPassed&&abEligible?'eligible_for_human_review':'reject_candidate',
  qualityDelta:abReport.qualityDelta,
  baselineLatencyMs:abReport.baselineLatencyMs,
  candidateLatencyMs:abReport.candidateLatencyMs,
  newFailures:[...abReport.newFailures],
  latencyWithinLimit:abReport.latencyWithinLimit
 });
 return Object.freeze({
  status:record.recommendation,record,
  patchEvidenceHash:evidenceHash,patchManifestHash:evidence.manifestHash,
  requiresHumanReview:true,automaticPromotion:false,
  sandboxAttested:false,modelIdentityVerified:false,
  note:'Reports are caller supplied; hashes detect changes but do not prove independent execution or identity'
 });
}
