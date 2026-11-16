import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consolidateLiaExperiences} from './lia-experience-consolidation.mjs';
const item=(content,extras={})=>({characterId:'atlas',kind:'skill',content,consentToRetain:true,evidenceVerified:true,priority:.7,...extras});
test('consolidation deduplicates and ranks bounded local memories',()=>{
 const x=consolidateLiaExperiences([item('A'),item(' A  '),item('B',{priority:.9}),item('C',{priority:.2})],{maxMemories:2});
 assert.equal(x.retained.length,2);
 assert.equal(x.duplicates,1);
 assert.equal(x.capacityDropped,1);
 assert.equal(x.retained[0].content,'B');
 assert.equal(x.trainedWeights,false);
 assert.equal(x.rawInputsDeleted,false);
 assert.equal(x.networkAccess,false);
});
test('consent and unverified evidence are excluded by default',()=>{
 const x=consolidateLiaExperiences([item('A',{consentToRetain:false}),item('B',{evidenceVerified:false})]);
 assert.equal(x.retained.length,0);
 assert.equal(x.rejected,2);
});
test('invalid priorities and IDs fail closed',()=>{
 assert.throws(()=>consolidateLiaExperiences([item('X',{priority:2})]));
 assert.throws(()=>consolidateLiaExperiences([item('X',{characterId:'../../secret'})]));
});
