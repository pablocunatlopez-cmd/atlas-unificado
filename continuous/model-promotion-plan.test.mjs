import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPromotionPlan} from './model-promotion-plan.mjs';
const revision='a'.repeat(40),benchmark='b'.repeat(40);
const ranking={recommended:'qwen',results:[{name:'qwen',accepted:true},{name:'other',accepted:false}]};
const input={candidate:'qwen',ranking,baselineRevision:revision,benchmarkRevision:benchmark};
test('requires explicit human approval even for the best candidate',()=>{
 const result=createPromotionPlan(input);
 assert.equal(result.ready,false);
 assert.equal(result.reason,'human_approval_required');
 assert.deepEqual(result.actions,[]);
});
test('creates a non-executing staged plan only after approval',()=>{
 const result=createPromotionPlan({...input,approval:true});
 assert.equal(result.ready,true);
 assert.ok(result.actions.includes('preserve_rollback_snapshot'));
 assert.ok(result.actions.includes('require_explicit_deployment_confirmation'));
});
test('rejects failed or non-recommended candidates',()=>{
 assert.equal(createPromotionPlan({...input,candidate:'other',approval:true}).ready,false);
 assert.equal(createPromotionPlan({...input,candidate:'unknown',approval:true}).ready,false);
});
test('rejects missing immutable revision evidence',()=>{
 assert.throws(()=>createPromotionPlan({...input,baselineRevision:'main',approval:true}));
 assert.throws(()=>createPromotionPlan({...input,benchmarkRevision:'latest',approval:true}));
});
