import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendAtlasEvaluationHistory,verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
const record={
 baselineId:'model-a',candidateId:'model-b',
 recommendation:'eligible_for_human_review',qualityDelta:0.25,
 baselineLatencyMs:100,candidateLatencyMs:110,
 newFailures:[],latencyWithinLimit:true
};
test('appends verifiable sequential A/B records',()=>{
 const first=appendAtlasEvaluationHistory({record,timestamp:1000});
 const second=appendAtlasEvaluationHistory({entries:first,
  record:{...record,candidateId:'model-c'},timestamp:2000});
 assert.equal(second.length,2);
 assert.equal(second[1].previousHash,second[0].hash);
 assert.equal(verifyAtlasEvaluationHistory(second).valid,true);
});
test('detects record tampering',()=>{
 const entries=appendAtlasEvaluationHistory({record,timestamp:1000});
 const altered=[{...entries[0],data:{...entries[0].data,qualityDelta:1}}];
 assert.throws(()=>verifyAtlasEvaluationHistory(altered),/hash mismatch/);
});
test('rejects invalid records',()=>{
 assert.throws(()=>appendAtlasEvaluationHistory({
  record:{...record,qualityDelta:Infinity},timestamp:1000
 }),/Invalid A\/B history record/);
});
