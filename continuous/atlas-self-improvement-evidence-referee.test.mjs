import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refereeAtlasDebateEvidence} from './atlas-self-improvement-evidence-referee.mjs';
const proposal={id:'SELF_014'};
const sources=[{path:'docs/roadmap.md',content:'Header\nMilestone incomplete\nNo test results'}];
const claims=[
 {id:'C1',role:'proponent',statement:'Roadmap is incomplete',path:'docs/roadmap.md',
  line:2,quote:'Milestone incomplete'},
 {id:'C2',role:'adversary',statement:'Tests are not yet verified',path:'docs/roadmap.md',
  line:3,quote:'No test results'}
];
test('referee verifies source quotes without claiming semantic truth',()=>{
 const r=refereeAtlasDebateEvidence({proposal,sources,claims});
 assert.equal(r.allQuotationsMatched,true);
 assert.equal(r.findings[0].status,'quotation_matched');
 assert.equal(r.findings[1].semanticTruth,'not_assessed');
 assert.equal(r.semanticContradictionsDetected,false);
 assert.equal(r.codeExecuted,false);
});
test('referee marks forged quotes unverified',()=>{
 const r=refereeAtlasDebateEvidence({proposal,sources,claims:[
  {...claims[0],quote:'Milestone complete'}]});
 assert.equal(r.allQuotationsMatched,false);
 assert.equal(r.findings[0].status,'unverified');
});
test('referee rejects duplicate identifiers and invalid roles',()=>{
 assert.throws(()=>refereeAtlasDebateEvidence({proposal,sources,claims:[claims[0],claims[0]]}));
 assert.throws(()=>refereeAtlasDebateEvidence({proposal,sources,claims:[
  {...claims[0],role:'executor'}]}));
});
