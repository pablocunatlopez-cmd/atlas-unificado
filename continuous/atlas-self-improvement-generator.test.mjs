import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proposeAtlasSelfImprovement} from './atlas-self-improvement-generator.mjs';
const base={constitution:'Never claim unverified outcomes.',
 roadmap:'Milestone 7 — measured autonomous improvement',
 repositoryContext:'docs/ATLAS_MASTER_ROADMAP.md: Milestone 7 incomplete'};
const observation={id:'SELF_004',area:'correctness',problem:'No evidence for proposals',
 evidence:'Milestone 7 is incomplete',principle:'Never claim unverified outcomes.',
 roadmapReference:'Milestone 7',candidates:[
 {description:'Require evidence references',risk:'More review work',acceptanceCriterion:'Manual source check',estimatedBenefit:4,estimatedRisk:1},
 {description:'Trust model claims',risk:'Hallucinations',acceptanceCriterion:'Independent verification',estimatedBenefit:2,estimatedRisk:4}]};
test('generator validates one model proposal and routes it through critic',async()=>{
 let calls=0;
 const result=await proposeAtlasSelfImprovement({...base,generateProposal:async prompt=>{
  calls++;assert.equal(prompt.constraints.includes('Do not execute code'),true);
  return {observations:[observation]};
 }});
 assert.equal(calls,1);assert.equal(result.mode,'dry_run');
 assert.equal(result.plan.proposals.length,1);
 assert.equal(result.review.reviews.length,1);
 assert.equal(result.authorizationGranted,false);
 assert.equal(result.modelOutputTrust,'unverified_model_generated');
});
test('generator rejects ungrounded model output',async()=>{
 await assert.rejects(()=>proposeAtlasSelfImprovement({...base,
  generateProposal:async()=>({observations:[{...observation,principle:'Invented'}]})}));
});
test('generator rejects empty and excessive context',async()=>{
 await assert.rejects(()=>proposeAtlasSelfImprovement({...base,repositoryContext:' '.repeat(10),
  generateProposal:async()=>({observations:[observation]})}));
 await assert.rejects(()=>proposeAtlasSelfImprovement({...base,repositoryContext:'x'.repeat(40001),
  generateProposal:async()=>({observations:[observation]})}));
});
