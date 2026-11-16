import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAtlasCodingAuditReport} from './atlas-coding-audit-report.mjs';
const base={proposalId:'task',transactionId:'tx'};
test('audit report redacts arbitrary payload and does not grant authorization',()=>{
 const report=buildAtlasCodingAuditReport({...base,observations:[
  {atMs:10,status:'planned',source:'planner',signature:'SECRET',content:'SECRET'},
  {atMs:20,status:'host_reported_committed',source:'host',token:'SECRET'}]});
 assert.equal(report.authorizationGranted,false);
 assert.equal(JSON.stringify(report).includes('SECRET'),false);
 assert.equal(report.events[1].trust,'host_reported_unverified');
});
test('uncertain outcomes always require human review',()=>{
 const report=buildAtlasCodingAuditReport({...base,observations:[
  {atMs:10,status:'outcome_unknown',source:'recovery'}]});
 assert.equal(report.needsHumanReview,true);
});
test('unknown statuses and malformed records fail closed',()=>{
 assert.throws(()=>buildAtlasCodingAuditReport({...base,observations:[
  {atMs:0,status:'authorized',source:'host'}]}));
});
