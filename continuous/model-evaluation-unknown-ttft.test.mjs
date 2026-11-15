import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRuns,evaluateCandidate} from './model-evaluation-gate.mjs';
import {rankModelCandidates} from './model-candidate-ranking.mjs';

test('missing first-token observations remain unknown rather than fabricated',()=>{
 const base=summarizeRuns([{id:'one',passed:true,durationMs:100,ttftMs:null}]);
 const next=summarizeRuns([{id:'one',passed:true,durationMs:90,ttftMs:null}]);
 assert.equal(base.ttftP95Ms,null);
 assert.equal(next.ttftP95Ms,null);
 assert.equal(evaluateCandidate(base,next).accepted,true);
 assert.equal(rankModelCandidates([{id:'one',passed:true,durationMs:100,ttftMs:null}],
  [{name:'candidate',runs:[{id:'one',passed:true,durationMs:90,ttftMs:null}]}]).recommended,'candidate');
});
test('measured TTFT regression is still rejected',()=>{
 const baseline=summarizeRuns([{id:'one',passed:true,durationMs:200,ttftMs:40}]);
 const candidate=summarizeRuns([{id:'one',passed:true,durationMs:190,ttftMs:100}]);
 assert.ok(evaluateCandidate(baseline,candidate).reasons.includes('first_token_regression'));
});

test('candidate cannot hide a measured TTFT regression by omitting timing',()=>{
 const baseline=summarizeRuns([{id:'one',passed:true,durationMs:200,ttftMs:40}]);
 const candidate=summarizeRuns([{id:'one',passed:true,durationMs:190,ttftMs:null}]);
 assert.ok(evaluateCandidate(baseline,candidate).reasons.includes('missing_first_token_measurement'));
});
