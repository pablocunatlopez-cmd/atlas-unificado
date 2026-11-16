import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAtlasSelfImprovementDryLoop} from './atlas-self-improvement-loop.mjs';
const observation={id:'SELF_001',area:'reliability',problem:'Missing iteration',
 evidence:'Roadmap incomplete',principle:'Never claim unverified outcomes.',
 roadmapReference:'Milestone 7',candidates:[
 {description:'Declarative review',risk:'Unverified estimates',acceptanceCriterion:'Independent audit',estimatedBenefit:4,estimatedRisk:1},
 {description:'Unreviewed patch',risk:'Unexpected behavior',acceptanceCriterion:'Independent tests',estimatedBenefit:3,estimatedRisk:4}]};
const base={constitution:'Never claim unverified outcomes.',roadmap:'Milestone 7 — measured autonomous improvement'};
test('loop detects unchanged proposal and stops without execution',()=>{
 const result=runAtlasSelfImprovementDryLoop({...base,rounds:[[observation],[observation]]});
 assert.equal(result.stopReason,'stagnation');assert.equal(result.roundsCompleted,1);
 assert.equal(result.codeExecuted,false);assert.equal(result.patchApplied,false);
});
test('loop stops when every option requires revision',()=>{
 const result=runAtlasSelfImprovementDryLoop({...base,rounds:[[observation]],
  rejectedHistory:['Declarative review']});
 assert.equal(result.stopReason,'all_candidates_need_revision');
 assert.equal(result.authorizationGranted,false);
});
test('loop rejects unbounded iterations',()=>{
 assert.throws(()=>runAtlasSelfImprovementDryLoop({...base,maxRounds:11,rounds:[]}));
});
test('loop stops on empty observations',()=>{
 const result=runAtlasSelfImprovementDryLoop({...base,rounds:[[]]});
 assert.equal(result.stopReason,'no_proposals');
});
