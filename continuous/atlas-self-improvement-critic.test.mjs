import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasSelfImprovement} from './atlas-self-improvement-planner.mjs';
import {critiqueAtlasSelfImprovement} from './atlas-self-improvement-critic.mjs';
const input={constitution:'Never claim unverified outcomes.',roadmap:'Milestone 7 — measured autonomous improvement',
 observations:[{id:'SELF_001',area:'reliability',problem:'No common proposal cycle',
 evidence:'Roadmap marks the experiment loop incomplete',
 principle:'Never claim unverified outcomes.',roadmapReference:'Milestone 7',
 candidates:[
 {description:'Pure proposal generator',risk:'No runtime proof',acceptanceCriterion:'Independent review',estimatedBenefit:4,estimatedRisk:1},
 {description:'Immediate execution',risk:'Unreviewed changes',acceptanceCriterion:'Sandbox tests',estimatedBenefit:5,estimatedRisk:5}]}]};
test('critic marks risky and previously rejected options without executing them',()=>{
 const plan=planAtlasSelfImprovement(input);
 const result=critiqueAtlasSelfImprovement(plan,{rejectedHistory:['Pure proposal generator']});
 assert.equal(result.mode,'dry_run');assert.equal(result.authorizationGranted,false);
 assert.equal(result.reviews[0].disposition,'revise_all_candidates');
 assert.deepEqual(result.reviews[0].candidates[0].concerns,['previously_rejected_candidate']);
 assert.equal(result.reviews[0].candidates[1].concerns.includes('high_estimated_risk'),true);
});
test('critic leaves safer proposals pending human review',()=>{
 const result=critiqueAtlasSelfImprovement(planAtlasSelfImprovement(input));
 assert.equal(result.reviews[0].disposition,'human_review_required');
 assert.equal(result.codeExecuted,false);assert.equal(result.patchApplied,false);
});
test('critic refuses plans that claim code was executed',()=>{
 const plan=planAtlasSelfImprovement(input);
 const forged={...plan,proposals:[{...plan.proposals[0],codeExecuted:true}]};
 assert.throws(()=>critiqueAtlasSelfImprovement(forged));
});
