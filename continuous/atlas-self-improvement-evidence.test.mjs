import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyAtlasProposalEvidence} from './atlas-self-improvement-evidence.mjs';
const proposal={id:'SELF_008'};
const sources=[{path:'docs/ATLAS_MASTER_ROADMAP.md',content:'Header\nMilestone 7 pending\nFooter'}];
test('matches an exact line quotation in supplied snapshot',()=>{
 const r=verifyAtlasProposalEvidence({proposal,sources,claims:[{
  proposalId:'SELF_008',path:sources[0].path,line:2,quote:'Milestone 7 pending'
 }]});
 assert.equal(r.verifiedAgainstSuppliedSnapshots,true);
 assert.equal(r.sourceTrust,'host_supplied_unverified');
 assert.equal(r.codeExecuted,false);
});
test('rejects false quotation without treating it as evidence',()=>{
 const r=verifyAtlasProposalEvidence({proposal,sources,claims:[{
  proposalId:'SELF_008',path:sources[0].path,line:2,quote:'Milestone 7 completed'
 }]});
 assert.equal(r.verifiedAgainstSuppliedSnapshots,false);
 assert.equal(r.findings[0].reason,'unverified_or_mismatched_quote');
});
test('rejects traversal paths, duplicate snapshots and mismatched proposal identifiers',()=>{
 assert.throws(()=>verifyAtlasProposalEvidence({proposal,
  sources:[{path:'../secret',content:'x'}],
  claims:[{proposalId:'SELF_008',path:'../secret',line:1,quote:'x'}]}));
 assert.throws(()=>verifyAtlasProposalEvidence({proposal,sources:[...sources,...sources],
  claims:[{proposalId:'SELF_008',path:sources[0].path,line:2,quote:'Milestone 7 pending'}]}));
 assert.throws(()=>verifyAtlasProposalEvidence({proposal,sources,
  claims:[{proposalId:'OTHER',path:sources[0].path,line:2,quote:'Milestone 7 pending'}]}));
});
