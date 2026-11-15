import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRuns,evaluateCandidate} from './model-evaluation-gate.mjs';

const runs=(durations,passes=durations.map(()=>true))=>durations.map((durationMs,i)=>({id:'case-'+i,passed:passes[i],durationMs,ttftMs:durationMs/2}));

test('summaries use actual measurements and deterministic nearest-rank percentiles',()=>{
 const result=summarizeRuns(runs([100,300,200,500,400]));
 assert.equal(result.latencyP50Ms,300);
 assert.equal(result.latencyP95Ms,500);
 assert.equal(result.ttftP95Ms,250);
 assert.equal(result.passRate,1);
});
test('quality regressions are rejected even when candidate is faster',()=>{
 const base=summarizeRuns(runs([100,100,100,100]));
 const candidate=summarizeRuns(runs([50,50,50,50],[true,true,true,false]));
 assert.deepEqual(evaluateCandidate(base,candidate).reasons,['candidate_below_quality_floor','candidate_quality_regression']);
});
test('latency regressions are rejected despite unchanged quality',()=>{
 const base=summarizeRuns(runs([100,100]));
 const candidate=summarizeRuns(runs([200,200]));
 assert.deepEqual(evaluateCandidate(base,candidate).reasons,['latency_regression','first_token_regression']);
});
test('equivalent or better candidate is accepted',()=>{
 assert.equal(evaluateCandidate(summarizeRuns(runs([100,100])),summarizeRuns(runs([90,90]))).accepted,true);
});
test('missing, duplicated, fabricated or invalid metrics are rejected',()=>{
 assert.throws(()=>summarizeRuns([]));
 assert.throws(()=>summarizeRuns([{id:'x',passed:true,durationMs:10,ttftMs:11}]));
 assert.throws(()=>summarizeRuns([{id:'x',passed:'yes',durationMs:10,ttftMs:2}]));
 assert.throws(()=>summarizeRuns([{id:'x',passed:true,durationMs:10,ttftMs:2},{id:'x',passed:true,durationMs:10,ttftMs:2}]));
 const a=summarizeRuns(runs([100,100]));
 assert.throws(()=>evaluateCandidate(a,summarizeRuns(runs([100]))));
});
