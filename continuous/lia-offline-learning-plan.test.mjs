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
