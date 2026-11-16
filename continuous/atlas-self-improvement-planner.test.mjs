import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasSelfImprovement} from './atlas-self-improvement-planner.mjs';
const input={constitution:'Never claim unverified outcomes.',roadmap:'Milestone 7 — measured autonomous improvement',
 observations:[{id:'SELF_001',area:'reliability',problem:'No common proposal cycle',
 evidence:'Roadmap marks the experiment loop incomplete',
 principle:'Never claim unverified outcomes.',
 roadmapReference:'Milestone 7',
 candidates:[
 {description:'Pure proposal generator',risk:'No runtime proof',acceptanceCriterion:'Independent review',estimatedBenefit:4,estimatedRisk:1},
 {description:'Immediate execution',risk:'Unreviewed changes',acceptanceCriterion:'Sandbox tests',estimatedBenefit:5,estimatedRisk:5}]}]};
test('self improvement produces ranked proposals without execution or approval',()=>{
 const result=planAtlasSelfImprovement(input);
 assert.equal(result.mode,'dry_run');
 assert.equal(result.proposals[0].preferredCandidateIndex,0);
 assert.equal(result.proposals[0].codeExecuted,false);
 assert.equal(result.proposals[0].patchApplied,false);
 assert.equal(result.proposals[0].requiresHumanApproval,true);
 assert.equal(result.capabilities.execute,false);
 assert.equal(Object.isFrozen(result.proposals[0].candidates[0]),true);
});
test('rejects ungrounded principles and roadmap claims',()=>{
 assert.throws(()=>planAtlasSelfImprovement({...input,observations:[{...input.observations[0],principle:'Invented principle'}]}));
});
test('rejects duplicate proposal identifiers',()=>{
 assert.throws(()=>planAtlasSelfImprovement({...input,observations:[input.observations[0],input.observations[0]]}));
});
