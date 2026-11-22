import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAtlasCodingPatchCAS} from './atlas-coding-atomic-commit.mjs';
const base='a'.repeat(40),digest='b'.repeat(64);
test('review-only evidence cannot trigger a commit',async()=>{
 let calls=0;
 const r=await applyAtlasCodingPatchCAS({expectedBaseCommit:base,diffDigest:digest,
  authorization:{authorized:false,proposalId:'task',baseCommit:base,diffDigest:digest},
  verifyAuthorization:async()=>true,atomicCommit:async()=>{calls++;return {committed:true,newCommit:'c'.repeat(40)}}});
 assert.equal(r.applied,false);assert.equal(calls,0);
});
test('host rejects changed HEAD without claiming application',async()=>{
 const r=await applyAtlasCodingPatchCAS({expectedBaseCommit:base,diffDigest:digest,
  authorization:{authorized:true,proposalId:'task',baseCommit:base,diffDigest:digest},
  verifyAuthorization:async()=>true,atomicCommit:async()=>({committed:false,reason:'stale'})});
 assert.equal(r.applied,false);assert.equal(r.reason,'cas_not_confirmed');
});
test('host confirmed atomic commit is reported, not performed by adapter',async()=>{
 let observed;
 const r=await applyAtlasCodingPatchCAS({expectedBaseCommit:base,diffDigest:digest,
  authorization:{authorized:true,proposalId:'task',baseCommit:base,diffDigest:digest},
  verifyAuthorization:async()=>true,atomicCommit:async input=>{observed=input;return {committed:true,newCommit:'c'.repeat(40)}}});
 assert.equal(r.applied,true);assert.equal(observed.expectedBaseCommit,base);
});
test('mismatched authorization never invokes host',async()=>{
 let calls=0;
 const r=await applyAtlasCodingPatchCAS({expectedBaseCommit:base,diffDigest:digest,
  authorization:{authorized:true,proposalId:'task',baseCommit:base,diffDigest:'d'.repeat(64)},
  verifyAuthorization:async()=>true,atomicCommit:async()=>{calls++;return {committed:true,newCommit:'c'.repeat(40)}}});
 assert.equal(r.applied,false);assert.equal(calls,0);
});

test('untrusted caller boolean is insufficient when host denies authorization',async()=>{
 let calls=0;
 const r=await applyAtlasCodingPatchCAS({expectedBaseCommit:base,diffDigest:digest,
  authorization:{authorized:true,proposalId:'task',baseCommit:base,diffDigest:digest},
  verifyAuthorization:async()=>false,
  atomicCommit:async()=>{calls++;return {committed:true,newCommit:'c'.repeat(40)}}});
 assert.equal(r.reason,'host_authorization_rejected');assert.equal(calls,0);
});
test('missing independent host authorization verifier blocks all commits',async()=>{
 let calls=0;
 const r=await applyAtlasCodingPatchCAS({expectedBaseCommit:base,diffDigest:digest,
  authorization:{authorized:true,proposalId:'task',baseCommit:base,diffDigest:digest},
  atomicCommit:async()=>{calls++;return {committed:true,newCommit:'c'.repeat(40)}}});
 assert.equal(r.applied,false);assert.equal(calls,0);
});
