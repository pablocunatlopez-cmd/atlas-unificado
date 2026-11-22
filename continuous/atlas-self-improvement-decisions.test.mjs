import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendAtlasDecision,compareAtlasDecisions} from './atlas-self-improvement-decisions.mjs';
const evidenceA='a'.repeat(64),evidenceB='b'.repeat(64);
const first={sequence:1,proposalId:'SELF_009',status:'needs_evidence',
 reason:'No verified source lines',evidenceDigest:evidenceA};
test('records a reasoned change of decision and evidence digest',()=>{
 const one=appendAtlasDecision({entry:first});
 const two=appendAtlasDecision({history:one,entry:{sequence:2,
  proposalId:'SELF_009',status:'approved_for_review',
  reason:'New exact quotations supplied',evidenceDigest:evidenceB}});
 const result=compareAtlasDecisions(two,'SELF_009');
 assert.equal(result.status,'approved_for_review');
 assert.equal(result.changes.length,1);
 assert.equal(result.changes[0].reason,'New exact quotations supplied');
 assert.equal(Object.isFrozen(two),true);
});
test('detects tampering with the decision chain',()=>{
 const one=appendAtlasDecision({entry:first});
 const forged=[{...one[0],reason:'Edited after recording'}];
 assert.throws(()=>compareAtlasDecisions(forged,'SELF_009'),/Tampered/);
 assert.throws(()=>appendAtlasDecision({history:forged,entry:{...first,sequence:2}}),/Tampered/);
});
test('rejects invalid transitions and oversized history',()=>{
 assert.throws(()=>appendAtlasDecision({entry:{...first,status:'execute'}}));
 assert.throws(()=>appendAtlasDecision({entry:{...first,sequence:2}}));
});
