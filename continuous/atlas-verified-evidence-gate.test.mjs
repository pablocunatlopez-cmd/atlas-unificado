import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAtlasVerifiedChange} from './atlas-verified-evidence-gate.mjs';
const commitSha='a'.repeat(40);
const base={proposalId:'change-1',commitSha,actions:[{kind:'write',target:'src/main.mjs'}]};
test('does not trust unverified booleans or unverified evidence',async()=>{
 const evidence=['syntax','unit','security','approval'].map(kind=>({kind,verified:true}));
 const result=await evaluateAtlasVerifiedChange({...base,evidence,verifyEvidence:async()=>false});
 assert.equal(result.readyForHumanReview,false);
 assert.deepEqual(result.missingEvidence,['syntax','unit','security','approval']);
 assert.equal(result.executionAuthorized,false);
});
test('requires exact commit-bound trusted verification',async()=>{
 const evidence=['syntax','unit','security','approval'].map(kind=>({kind,commitSha}));
 const verifyEvidence=async(item,context)=>item.commitSha===context.commitSha;
 const result=await evaluateAtlasVerifiedChange({...base,evidence,verifyEvidence});
 assert.equal(result.readyForHumanReview,true);
 assert.equal(result.executionAuthorized,false);
 const wrong=await evaluateAtlasVerifiedChange({...base,evidence:evidence.map(x=>({...x,commitSha:'b'.repeat(40)})),verifyEvidence});
 assert.equal(wrong.readyForHumanReview,false);
});
test('requires verifier and valid commit',async()=>{
 await assert.rejects(evaluateAtlasVerifiedChange({...base,verifyEvidence:null}));
 await assert.rejects(evaluateAtlasVerifiedChange({...base,commitSha:'invalid',verifyEvidence:async()=>true}));
});
test('passes an optional proposal digest and immutable actions to the verifier',async()=>{
 const proposalDigest='b'.repeat(64);
 const actions=[{kind:'write',target:'src/main.mjs'}];
 const result=await evaluateAtlasVerifiedChange({...base,proposalDigest,actions,
  evidence:[{kind:'syntax'}],verifyEvidence:async(item,context)=>{
   assert.equal(context.proposalDigest,proposalDigest);
   assert.ok(Object.isFrozen(context));
   assert.ok(Object.isFrozen(context.actions));
   assert.ok(Object.isFrozen(context.actions[0]));
   actions[0].target='src/other.mjs';
   assert.equal(context.actions[0].target,'src/main.mjs');
   return true;
  }});
 assert.equal(result.proposalDigest,proposalDigest);
 assert.deepEqual(result.missingEvidence,['unit','security','approval']);
 await assert.rejects(evaluateAtlasVerifiedChange({...base,proposalDigest:'invalid',verifyEvidence:async()=>true}));
});
test('snapshots all evidence before awaiting the verifier',async()=>{
 const evidence=[
  {kind:'syntax',claim:{kind:'syntax'}},
  {kind:'unit',claim:{kind:'unit'}}
 ];
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 let first=true;
 const pending=evaluateAtlasVerifiedChange({...base,evidence,verifyEvidence:async item=>{
  if(first){first=false;await waiting;}
  return item.kind==='approval'&&item.claim.kind==='approval';
 }});
 for(const item of evidence){
  item.kind='approval';
  item.claim.kind='approval';
 }
 release();
 const result=await pending;
 assert.deepEqual(result.verifiedChecks,[]);
 assert.deepEqual(result.missingEvidence,['syntax','unit','security','approval']);
 assert.equal(result.readyForHumanReview,false);
});
test('rejects shared evidence memory instead of retaining a mutable external reference',async()=>{
 const shared=new Uint8Array(new SharedArrayBuffer(1));
 await assert.rejects(evaluateAtlasVerifiedChange({...base,
  evidence:[{kind:'syntax',nested:new Map([['data',shared]])}],
  verifyEvidence:async()=>true}),/Shared evidence memory/);
});
