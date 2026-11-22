import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consolidateLiaExperiences} from './lia-experience-consolidation.mjs';
import {planLiaOfflineLearning} from './lia-offline-learning-plan.mjs';
import {auditLiaLearningDataset} from './lia-learning-dataset-audit.mjs';
const e=(characterId,content)=>({characterId,kind:'skill',content,consentToRetain:true,evidenceVerified:true,priority:.5});
test('audit accepts clean held-out partitions',()=>{
 const c=consolidateLiaExperiences(Array.from({length:12},(_,i)=>e('atlas','Unique example '+i)));
 const p=planLiaOfflineLearning(c,{baseModelId:'local'});
 const a=auditLiaLearningDataset(c,p);
 assert.equal(a.passed,true);
 assert.equal(a.auditedCount,12);
 assert.equal(a.trainingExecuted,false);
});
test('audit catches cross-character near-duplicate train/holdout leakage',()=>{
 const c=consolidateLiaExperiences([e('atlas','same concept'),e('ion',' SAME  CONCEPT ')]);
 const hashes=c.retained.map(x=>x.contentHash);
 const p={schema:'lia-offline-learning-plan-v1',trainingHashes:[hashes[0]],holdoutHashes:[hashes[1]],eligibleCount:2};
 const a=auditLiaLearningDataset(c,p);
 assert.equal(a.passed,false);
 assert.equal(a.contentLeakageDetected,true);
});
test('audit rejects absent and overlapping hashes',()=>{
 const c=consolidateLiaExperiences([e('atlas','one')]);
 const h=c.retained[0].contentHash;
 const p={schema:'lia-offline-learning-plan-v1',trainingHashes:[h,'missing'],holdoutHashes:[h],eligibleCount:3};
 const a=auditLiaLearningDataset(c,p);
 assert.equal(a.passed,false);
 assert.ok(a.issues.includes('same-memory-in-train-and-holdout'));
 assert.ok(a.issues.includes('missing-memory-hash'));
});
