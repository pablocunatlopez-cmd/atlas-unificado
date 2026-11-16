import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendAtlasDecision} from './atlas-self-improvement-decisions.mjs';
import {assessAtlasDecisionConsistency} from './atlas-self-improvement-consistency.mjs';
const proposal={id:'SELF_010'};
const evidence={verifiedAgainstSuppliedSnapshots:true,snapshotDigest:'b'.repeat(64)};
const history=appendAtlasDecision({entry:{sequence:1,proposalId:proposal.id,
 status:'rejected',reason:'Missing proof',evidenceDigest:'a'.repeat(64)}});
test('holds a previously rejected proposal even when evidence changes',()=>{
 const r=assessAtlasDecisionConsistency({proposal,history,evidence,
  changeExplanation:'New source lines supplied'});
 assert.equal(r.recommendation,'hold_for_review');
 assert.equal(r.reasons.includes('previously_rejected'),true);
 assert.equal(r.authorizationGranted,false);
});
test('requires explanation for changed evidence digest',()=>{
 const r=assessAtlasDecisionConsistency({proposal,history,evidence});
 assert.equal(r.reasons.includes('changed_evidence_without_explanation'),true);
});
test('blocks proposals with no verified evidence',()=>{
 const r=assessAtlasDecisionConsistency({proposal,history:[]});
 assert.equal(r.recommendation,'hold_for_review');
 assert.equal(r.reasons.includes('no_verified_snapshot_quotes'),true);
});
test('only suggests human review with verified evidence and no prior conflict',()=>{
 const r=assessAtlasDecisionConsistency({proposal,history:[],evidence});
 assert.equal(r.recommendation,'eligible_for_human_review');
 assert.equal(r.codeExecuted,false);assert.equal(r.patchApplied,false);
});
