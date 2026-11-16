import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {attemptAtlasCodingCommit} from './atlas-coding-commit-attempt.mjs';
const base='a'.repeat(40),digest='b'.repeat(64);
const auth={authorized:true,proposalId:'task',baseCommit:base,diffDigest:digest};
async function withDir(fn){const directory=await mkdtemp(join(tmpdir(),'atlas-attempt-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}
test('duplicate attempts never invoke atomic commit twice',()=>withDir(async directory=>{
 let calls=0;
 const args={directory,transactionId:'tx',proposalId:'task',expectedBaseCommit:base,diffDigest:digest,
  authorization:auth,verifyAuthorization:async()=>true,
  atomicCommit:async()=>{calls++;return {committed:true,newCommit:'c'.repeat(40)}}};
 const results=await Promise.all([attemptAtlasCodingCommit(args),attemptAtlasCodingCommit(args)]);
 assert.equal(results.filter(x=>x.applied).length,1);
 assert.equal(calls,1);
}));
test('host exception is outcome unknown and retry is blocked',()=>withDir(async directory=>{
 let calls=0;
 const args={directory,transactionId:'tx',proposalId:'task',expectedBaseCommit:base,diffDigest:digest,
  authorization:auth,verifyAuthorization:async()=>true,
  atomicCommit:async()=>{calls++;throw Error('connection lost')}};
 const first=await attemptAtlasCodingCommit(args);
 assert.equal(first.status,'outcome_unknown');assert.equal(first.retrySafe,false);
 const second=await attemptAtlasCodingCommit(args);
 assert.equal(second.reason,'already_recorded');assert.equal(calls,1);
}));
test('host authorization denial writes no intent and invokes no commit',()=>withDir(async directory=>{
 let calls=0;
 const args={directory,transactionId:'tx',proposalId:'task',expectedBaseCommit:base,diffDigest:digest,
  authorization:auth,verifyAuthorization:async()=>false,
  atomicCommit:async()=>{calls++;return {committed:true,newCommit:'c'.repeat(40)}}};
 assert.equal((await attemptAtlasCodingCommit(args)).reason,'host_authorization_rejected');
 assert.equal(calls,0);
}));
