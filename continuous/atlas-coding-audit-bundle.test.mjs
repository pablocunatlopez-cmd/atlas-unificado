import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAtlasCodingAuditBundle,verifyAtlasCodingAuditBundle} from './atlas-coding-audit-bundle.mjs';
const args={proposalId:'proposal',transactionId:'tx',observations:[
 {atMs:1,status:'intent_recorded',source:'planner'},
 {atMs:2,status:'outcome_unknown',source:'host'}]};
test('audit bundle checks integrity without granting permission',()=>{
 const bundle=buildAtlasCodingAuditBundle(args);
 const result=verifyAtlasCodingAuditBundle(bundle);
 assert.equal(result.valid,true);assert.equal(result.anchored,false);
 assert.equal(result.authorizationGranted,false);
 assert.equal(verifyAtlasCodingAuditBundle(bundle,{trustedFinalHash:bundle.chain.finalHash}).anchored,true);
});
test('report event tampering is detected even with an unchanged chain',()=>{
 const bundle=buildAtlasCodingAuditBundle(args);
 const report={...bundle.report,events:[{...bundle.report.events[0],status:'review_blocked'},bundle.report.events[1]]};
 assert.equal(verifyAtlasCodingAuditBundle({...bundle,report}).valid,false);
});
test('bundle refuses unrelated transaction chains',()=>{
 const bundle=buildAtlasCodingAuditBundle(args);
 assert.equal(verifyAtlasCodingAuditBundle({...bundle,chain:{...bundle.chain,transactionId:'other'}}).valid,false);
});
