import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessAtlasPatchCandidate} from './atlas-patch-ab-review-gate.mjs';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const evidence={proposalId:'test',baseRevision:'a'.repeat(40),
 manifestHash:'b'.repeat(64),changes:[],testStatus:'passed',
 exitCode:0,timedOut:false,outputTruncated:false,
 stdout:'ok',stderr:'',sandboxAttested:false};
const patchReport={status:'tests_reported_passed',readyToMerge:false,
 originalRepositoryModified:false,
 evidence:{...evidence,evidenceHash:sha(evidence)}};
const abReport={status:'completed',recommendation:'eligible_for_human_review',
 qualityDelta:0.1,baselineLatencyMs:10,candidateLatencyMs:10,
 newFailures:[],latencyWithinLimit:true};
const args={patchReport,abReport,baselineId:'baseline',candidateId:'candidate'};
test('permits only manual review when both reported checks pass',()=>{
 const result=assessAtlasPatchCandidate(args);
 assert.equal(result.status,'eligible_for_human_review');
 assert.equal(result.automaticPromotion,false);
 assert.equal(result.sandboxAttested,false);
});
test('rejects failed patch checks and A/B regression',()=>{
 assert.equal(assessAtlasPatchCandidate({...args,
  patchReport:{...patchReport,status:'tests_reported_failed',
   evidence:{...patchReport.evidence,testStatus:'failed',
    evidenceHash:sha({...evidence,testStatus:'failed'})}}
 }).status,'reject_candidate');
 assert.equal(assessAtlasPatchCandidate({...args,
  abReport:{...abReport,newFailures:['regression']}
 }).status,'reject_candidate');
});
test('rejects tampered report hashes',()=>{
 assert.throws(()=>assessAtlasPatchCandidate({...args,
  patchReport:{...patchReport,evidence:{...patchReport.evidence,stdout:'changed'}}
 }),/Inconsistent patch candidate evidence/);
});
