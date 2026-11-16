import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recordAtlasCodingIntent} from './atlas-coding-intent-log.mjs';
import {auditAtlasCodingTransaction} from './atlas-coding-audit-transaction.mjs';
const base={transactionId:'tx',proposalId:'task',baseCommit:'a'.repeat(40),diffDigest:'b'.repeat(64)};
async function withDir(fn){const directory=await mkdtemp(join(tmpdir(),'atlas-audit-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}
test('audit projects persisted intent without claiming commit or permission',()=>withDir(async directory=>{
 await recordAtlasCodingIntent({...base,directory});
 const r=await auditAtlasCodingTransaction({directory,transactionId:'tx',proposalId:'task',
  readHeadCommit:async()=>base.baseCommit,atMs:100});
 assert.equal(r.reconciliationStatus,'base_still_visible');
 assert.equal(r.authorizationGranted,false);assert.equal(r.retrySafe,false);
 assert.equal(r.events[0].source,'recovery');
}));
test('changed HEAD becomes manual review instead of false commit proof',()=>withDir(async directory=>{
 await recordAtlasCodingIntent({...base,directory});
 const r=await auditAtlasCodingTransaction({directory,transactionId:'tx',proposalId:'task',
  readHeadCommit:async()=> 'c'.repeat(40),atMs:100});
 assert.equal(r.needsHumanReview,true);
 assert.equal(r.reconciliationStatus,'head_changed_since_intent');
}));
test('missing persisted intent requires manual review',()=>withDir(async directory=>{
 const r=await auditAtlasCodingTransaction({directory,transactionId:'tx',proposalId:'task',
  readHeadCommit:async()=>base.baseCommit,atMs:100});
 assert.equal(r.needsHumanReview,true);
 assert.equal(r.reconciliationStatus,'intent_not_found');
}));
