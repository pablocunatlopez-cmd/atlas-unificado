import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {atlasApprovalMessage} from './atlas-signed-restore-approval.mjs';
import {claimAtlasReviewedRestoreApproval} from './atlas-reviewed-approval-claim.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const nowMs=1000000;
const unsigned={actorId:'operator',historyHash:'a'.repeat(64),
 restoreChecksum:'b'.repeat(64),approvedAt:nowMs};
const approval={...unsigned,signature:sign(null,
 atlasApprovalMessage(unsigned),privateKey).toString('base64')};
const args={approval,publicKey,expectedActorId:'operator',nowMs,
 expectedHistoryHash:unsigned.historyHash,
 expectedRestoreChecksum:unsigned.restoreChecksum,
 authorizeActor:async()=>true};
test('single-use claim is persisted and replay is blocked',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-claim-'));
 try{
  const first=await claimAtlasReviewedRestoreApproval({...args,directory});
  assert.equal(first.status,'approval_claimed_for_final_human_review');
  assert.equal(first.executesRestore,false);
  const second=await claimAtlasReviewedRestoreApproval({...args,directory});
  assert.equal(second.reason,'approval_already_consumed');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('wrong target and unauthorized actor do not consume',async()=>{
 let calls=0;
 const consume=async()=>{calls++;return {status:'consumed',consumed:true};};
 const mismatch=await claimAtlasReviewedRestoreApproval({...args,
  expectedHistoryHash:'c'.repeat(64),consume});
 assert.equal(mismatch.reason,'approval_target_mismatch');
 const denied=await claimAtlasReviewedRestoreApproval({...args,
  authorizeActor:async()=>false,consume});
 assert.equal(denied.reason,'actor_not_authorized');
 assert.equal(calls,0);
});
test('expired approval is rejected before authorization',async()=>{
 let authorized=false;
 const result=await claimAtlasReviewedRestoreApproval({...args,
  nowMs:nowMs+300001,
  authorizeActor:async()=>{authorized=true;return true;},
  consume:async()=>{throw Error('must not consume');}
 });
 assert.equal(result.reason,'approval_expired');
 assert.equal(authorized,false);
});
