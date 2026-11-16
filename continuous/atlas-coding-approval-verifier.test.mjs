import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {atlasCodingApprovalMessage,verifyAtlasCodingApproval} from './atlas-coding-approval-verifier.mjs';

const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const digest=x=>createHash('sha256').update(x).digest('hex');
const expected={proposalId:'task-1',actorId:'owner',operation:'write',
 baseCommit:'a'.repeat(40),diffDigest:digest('diff')};
const nowMs=1000000;
function signed(extra={}){
 const claim={...expected,nonce:digest('unique'),issuedAt:nowMs,...extra};
 return {...claim,signature:sign(null,atlasCodingApprovalMessage(claim),privateKey).toString('base64')};
}
function options(claim,overrides={}){
 return {claim,expected,publicKey,nowMs,authorizeActor:async()=>true,
 consumeNonce:async()=>true,...overrides};
}
test('valid signed claim remains review-only',async()=>{
 const r=await verifyAtlasCodingApproval(options(signed()));
 assert.equal(r.status,'verified_for_final_review');
 assert.equal(r.authorized,false);
 assert.equal(r.executesCode,false);
});
test('tampering and wrong target are blocked',async()=>{
 const claim=signed();
 assert.equal((await verifyAtlasCodingApproval(options({...claim,diffDigest:digest('other')}))).status,'blocked');
 assert.equal((await verifyAtlasCodingApproval(options(claim,{expected:{...expected,baseCommit:'b'.repeat(40)}}))).reason,'target_mismatch');
});
test('expired claims and unauthorized actors are blocked',async()=>{
 assert.equal((await verifyAtlasCodingApproval(options(signed({issuedAt:1})))).reason,'expired_or_future');
 assert.equal((await verifyAtlasCodingApproval(options(signed(),{authorizeActor:async()=>false}))).reason,'actor_not_authorized');
});
test('replayed nonce is blocked by host consumption',async()=>{
 const seen=new Set();
 const consumeNonce=async({nonce})=>{if(seen.has(nonce))return false;seen.add(nonce);return true;};
 const claim=signed();
 assert.equal((await verifyAtlasCodingApproval(options(claim,{consumeNonce}))).status,'verified_for_final_review');
 assert.equal((await verifyAtlasCodingApproval(options(claim,{consumeNonce}))).reason,'nonce_not_consumed');
});
test('missing trusted callbacks fail closed',async()=>{
 await assert.rejects(()=>verifyAtlasCodingApproval(options(signed(),{consumeNonce:null})));
});
