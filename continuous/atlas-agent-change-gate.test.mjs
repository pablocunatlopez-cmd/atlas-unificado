import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAtlasAgentChange} from './atlas-agent-change-gate.mjs';
const checks={syntax:true,unit:true,security:true};
test('read-only work can reach review without approval',()=>{
 const r=evaluateAtlasAgentChange({id:'task-1',actions:[{kind:'analyze',target:'continuous/'}],checks});
 assert.equal(r.readyForReview,true);assert.equal(r.requiresApproval,false);
});
test('write action requires trusted host attestation and checks',()=>{
 const base={id:'task-2',actions:[{kind:'write',target:'continuous/file.mjs'}],checks};
 assert.equal(evaluateAtlasAgentChange(base).readyForReview,false);
 assert.equal(evaluateAtlasAgentChange({...base,approval:{verifiedByHost:true,principal:'user',proposalId:'wrong'}}).readyForReview,false);
 assert.equal(evaluateAtlasAgentChange({...base,approval:{verifiedByHost:true,principal:'user',proposalId:'task-2'}}).readyForReview,true);
 assert.equal(evaluateAtlasAgentChange({...base,checks:{...checks,unit:false}}).readyForReview,false);
});
test('rejects unknown actions and traversal targets',()=>{
 assert.throws(()=>evaluateAtlasAgentChange({id:'task',actions:[{kind:'shell',target:'x'}]}));
 assert.throws(()=>evaluateAtlasAgentChange({id:'task',actions:[{kind:'read',target:'../secrets'}]}));
});

test('caller-supplied approval and checks never grant execution authorization',()=>{
 const r=evaluateAtlasAgentChange({id:'untrusted',actions:[{kind:'publish',target:'release'}],checks,
  approval:{verifiedByHost:true,principal:'owner',proposalId:'untrusted'}});
 assert.equal(r.readyForReview,true);
 assert.equal(r.authorizationGranted,false);
 assert.equal(r.evidenceStatus,'caller_supplied_unverified');
});
