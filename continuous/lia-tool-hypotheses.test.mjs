import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildVerifiedToolHypotheses} from './lia-tool-hypotheses.mjs';
test('validated deterministic tool output creates limited evidence record',()=>{
 const entries=buildVerifiedToolHypotheses({used:true,curriculumTaskId:'dag-dependency-plan',result:{order:[],blocked:[]}});
 assert.equal(entries.length,1);
 assert.equal(entries[0].status,'supported');
 assert.equal(entries[0].evidence[0].verified,true);
 assert.equal(entries[0].factualAccuracyVerified,false);
});
test('tool errors and absent execution do not create evidence',()=>{
 assert.deepEqual(buildVerifiedToolHypotheses(null),[]);
 assert.deepEqual(buildVerifiedToolHypotheses({used:true,error:'failed',curriculumTaskId:'dag-dependency-plan'}),[]);
});
