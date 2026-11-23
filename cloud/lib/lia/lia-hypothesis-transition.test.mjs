import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLiaHypothesisTransition} from './lia-hypothesis-transition.mjs';
test('recorded deterministic checks produce traceable transitions',()=>{
 const passed=evaluateLiaHypothesisTransition({previousStatus:'testing',check:{executed:true,kind:'citation-audit',outcome:'pass',reference:'chat:audit'}});
 assert.equal(passed.nextStatus,'supported');
 assert.equal(passed.rule,'recorded-check-passed');
 assert.equal(passed.factualAccuracyVerified,false);
 const failed=evaluateLiaHypothesisTransition({previousStatus:'supported',check:{executed:true,kind:'deterministic-tool',outcome:'fail',reference:'tool:123'}});
 assert.equal(failed.nextStatus,'refuted');
 assert.equal(failed.changed,true);
});
test('model review alone cannot establish factual truth',()=>{
 const result=evaluateLiaHypothesisTransition({previousStatus:'supported',check:{executed:true,kind:'model-review',outcome:'pass',reference:'chat:review'}});
 assert.equal(result.nextStatus,'inconclusive');
 assert.equal(result.rule,'model-review-does-not-prove-claim');
});
test('rejects missing executions and invalid outcomes',()=>{
 assert.throws(()=>evaluateLiaHypothesisTransition({previousStatus:'proposed',check:{kind:'citation-audit',outcome:'pass',reference:'x'}}));
 assert.throws(()=>evaluateLiaHypothesisTransition({previousStatus:'proposed',check:{executed:true,kind:'citation-audit',outcome:'magical',reference:'x'}}));
});
