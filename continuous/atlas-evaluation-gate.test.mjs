import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAtlasCandidate,atlasReviewPlan} from './atlas-evaluation-gate.mjs';
const base={queries:120,recallAt5:0.8,ndcgAt5:0.72,citationAccuracy:0.95,latencyP95Ms:100,memoryMb:500};
test('candidate cannot be auto-promoted even with improved metrics',()=>{
 const r=evaluateAtlasCandidate(base,{...base,recallAt5:0.85});
 assert.equal(r.verdict,'review-required');assert.equal(r.promote,false);
});
test('reject regressions and missing evaluations',()=>{
 assert.equal(evaluateAtlasCandidate(base,{...base,recallAt5:0.7}).verdict,'reject');
 assert.equal(evaluateAtlasCandidate(base,{...base,latencyP95Ms:200}).verdict,'reject');
 assert.equal(evaluateAtlasCandidate(base,{...base,queries:5}).verdict,'insufficient-evidence');
 assert.equal(evaluateAtlasCandidate(base,{...base,ndcgAt5:NaN}).verdict,'insufficient-evidence');
});
test('spiral review requires permission for observations and promotion',()=>{
 const plan=atlasReviewPlan({id:'a',goal:'Contrastar una hipótesis'});
 assert.deepEqual(plan.steps.map(s=>s.vertex),['mental','physical','god','mental']);
 assert.equal(plan.steps[1].requiresApproval,true);
 assert.equal(plan.autoPromote,false);
});
