import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {claimAtlasCodingReview} from './atlas-coding-review-claim.mjs';
import {atlasCodingApprovalMessage} from './atlas-coding-approval-verifier.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const nowMs=1000000;
const expected={proposalId:'task-1',actorId:'owner',operation:'write',
 baseCommit:'a'.repeat(40),diffDigest:digest('patch')};
const unsigned={...expected,nonce:digest('nonce'),issuedAt:nowMs};
const claim={...unsigned,signature:sign(null,atlasCodingApprovalMessage(unsigned),privateKey).toString('base64')};
test('durable local claim blocks replay and remains review-only',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-approval-'));
 try{
  const opts={claim,expected,publicKey,nowMs,directory,authorizeActor:async()=>true};
  const first=await claimAtlasCodingReview(opts);
  assert.equal(first.status,'verified_for_final_review');
  assert.equal(first.authorizationGranted,false);
  assert.equal(first.executesCode,false);
  const second=await claimAtlasCodingReview(opts);
  assert.equal(second.status,'blocked');
  assert.equal(second.reason,'nonce_not_consumed');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('host authorization denial cannot consume nonce',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-approval-'));
 try{
  const opts={claim,expected,publicKey,nowMs,directory,authorizeActor:async()=>false};
  assert.equal((await claimAtlasCodingReview(opts)).reason,'actor_not_authorized');
  assert.equal((await claimAtlasCodingReview({...opts,authorizeActor:async()=>true})).status,'verified_for_final_review');
 }finally{await rm(directory,{recursive:true,force:true});}
});
