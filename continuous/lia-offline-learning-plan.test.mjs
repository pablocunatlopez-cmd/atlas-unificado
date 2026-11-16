import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consolidateLiaExperiences} from './lia-experience-consolidation.mjs';
import {planLiaOfflineLearning} from './lia-offline-learning-plan.mjs';
test('offline plan separates train and holdout without touching weights',()=>{
 const x=consolidateLiaExperiences(Array.from({length:20},(_,i)=>({
  characterId:'atlas',kind:'skill',content:'Example '+i,consentToRetain:true,
  evidenceVerified:true,priority:.5})));
 const p=planLiaOfflineLearning(x,{baseModelId:'qwen-local',minimumVerified:10});
 assert.equal(p.eligibleCount,20);
 assert.equal(p.trainingCount+p.holdoutCount,20);
 assert.equal(p.trainingExecuted,false);
 assert.equal(p.adapterCreated,false);
 assert.equal(p.modelPromoted,false);
 assert.equal(p.candidateReadyForReview,true);
 assert.equal(new Set([...p.trainingHashes,...p.holdoutHashes]).size,20);
});
test('insufficient data cannot be marked ready',()=>{
 const x=consolidateLiaExperiences([{characterId:'atlas',kind:'skill',content:'One',consentToRetain:true,evidenceVerified:true,priority:1}]);
 assert.equal(planLiaOfflineLearning(x,{baseModelId:'local'}).candidateReadyForReview,false);
});

test('same concept from two characters cannot leak across partitions',()=>{
 const items=[...Array.from({length:10},(_,i)=>({characterId:'atlas',kind:'skill',content:'Different '+i,consentToRetain:true,evidenceVerified:true,priority:.5})),
  {characterId:'atlas',kind:'skill',content:'SHARED  concept',consentToRetain:true,evidenceVerified:true,priority:.5},
  {characterId:'ion',kind:'skill',content:'shared concept',consentToRetain:true,evidenceVerified:true,priority:.5}];
 const c=consolidateLiaExperiences(items);
 const p=planLiaOfflineLearning(c,{baseModelId:'local'});
 const shared=c.retained.filter(e=>e.content.toLowerCase().replace(/\s+/g,' ')==='shared concept').map(e=>e.contentHash);
 assert.equal(shared.length,2);
 assert.ok(shared.every(h=>p.trainingHashes.includes(h))||shared.every(h=>p.holdoutHashes.includes(h)));
});
