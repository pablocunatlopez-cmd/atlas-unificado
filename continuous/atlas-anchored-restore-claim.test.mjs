import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {createAtlasRestorePoint} from './atlas-restore-point.mjs';
import {atlasHistoryAnchorMessage} from './atlas-history-signed-anchor.mjs';
import {atlasApprovalMessage} from './atlas-signed-restore-approval.mjs';
import {claimAtlasAnchoredRestore} from './atlas-anchored-restore-claim.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const revision='a'.repeat(40),scope='atlas/test',nowMs=1000000;
const record={baselineId:'base',candidateId:'candidate',
 recommendation:'eligible_for_human_review',qualityDelta:0.1,
 baselineLatencyMs:10,candidateLatencyMs:10,
 newFailures:[],latencyWithinLimit:true};
const entries=appendAtlasEvaluationHistory({record,timestamp:100});
const point=createAtlasRestorePoint({revision,config:{modelId:'candidate'},
 historyHeadHash:entries[0].hash,createdAt:100});
const unsignedAnchor={scope,count:1,headHash:entries[0].hash};
const anchor={...unsignedAnchor,signature:sign(null,
 atlasHistoryAnchorMessage(unsignedAnchor),privateKey).toString('base64')};
const unsignedApproval={historyHash:entries[0].hash,
 restoreChecksum:point.checksum,approvedAt:nowMs,actorId:'operator'};
const approval={...unsignedApproval,signature:sign(null,
 atlasApprovalMessage(unsignedApproval),privateKey).toString('base64')};
const args={entries,anchor,anchorPublicKey:publicKey,
 expectedScope:scope,trustedCheckpoint:unsignedAnchor,
 restorePoints:[point],signedApprovals:[approval],
 approvalPublicKey:publicKey,expectedActorId:'operator',
 currentRevision:'b'.repeat(40),lookupCommit:async sha=>({sha}),
 authorizeActor:async()=>true,nowMs,directory:'/unused'};
test('verified history and approval are bound to exact restore point',async()=>{
 let calls=0;
 const result=await claimAtlasAnchoredRestore({...args,
  claimApproval:async options=>{
   calls++;
   assert.equal(options.expectedRestoreChecksum,point.checksum);
   assert.equal(options.expectedHistoryHash,entries[0].hash);
   return {status:'approval_claimed_for_final_human_review',approvalId:'c'.repeat(64)};
  }});
 assert.equal(result.status,'approval_claimed_pending_final_human_review');
 assert.equal(result.executesRestore,false);
 assert.equal(calls,1);
});
test('untrusted checkpoint blocks before consumption',async()=>{
 let called=false;
 await assert.rejects(claimAtlasAnchoredRestore({...args,
  trustedCheckpoint:{...unsignedAnchor,headHash:'d'.repeat(64)},
  claimApproval:async()=>{called=true;}
 }),/diverges/);
 assert.equal(called,false);
});
test('actor denial blocks before consumption',async()=>{
 let called=false;
 const result=await claimAtlasAnchoredRestore({...args,
  authorizeActor:async()=>false,
  claimApproval:async()=>{called=true;}
 });
 assert.equal(result.reason,'actor_not_authorized');
 assert.equal(called,false);
});
