import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {createAtlasRestorePoint} from './atlas-restore-point.mjs';
import {atlasHistoryAnchorMessage} from './atlas-history-signed-anchor.mjs';
import {atlasApprovalMessage} from './atlas-signed-restore-approval.mjs';
import {claimAtlasAnchoredRestore} from './atlas-anchored-restore-claim.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const scope='atlas/integration',revision='a'.repeat(40),nowMs=1000000;
const record={baselineId:'baseline',candidateId:'candidate',
 recommendation:'eligible_for_human_review',qualityDelta:0.1,
 baselineLatencyMs:10,candidateLatencyMs:10,newFailures:[],latencyWithinLimit:true};
const entries=appendAtlasEvaluationHistory({record,timestamp:100});
const point=createAtlasRestorePoint({revision,config:{modelId:'candidate'},
 historyHeadHash:entries[0].hash,createdAt:100});
const checkpoint={scope,count:1,headHash:entries[0].hash};
const anchor={...checkpoint,signature:sign(null,
 atlasHistoryAnchorMessage(checkpoint),privateKey).toString('base64')};
const approvalBody={historyHash:entries[0].hash,restoreChecksum:point.checksum,
 approvedAt:nowMs,actorId:'operator'};
const approval={...approvalBody,signature:sign(null,
 atlasApprovalMessage(approvalBody),privateKey).toString('base64')};
test('real local storage: concurrent full restore claims are single-use',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-full-claim-'));
 try{
  const args={entries,anchor,anchorPublicKey:publicKey,expectedScope:scope,
   trustedCheckpoint:checkpoint,restorePoints:[point],
   signedApprovals:[approval],approvalPublicKey:publicKey,
   expectedActorId:'operator',currentRevision:'b'.repeat(40),
   lookupCommit:async sha=>({sha}),authorizeActor:async()=>true,
   nowMs,directory};
  const results=await Promise.all(Array.from({length:8},()=>
   claimAtlasAnchoredRestore(args)));
  assert.equal(results.filter(r=>
   r.status==='approval_claimed_pending_final_human_review').length,1);
  assert.equal(results.filter(r=>
   r.reason==='approval_already_consumed').length,7);
  const winner=results.find(r=>r.approvalId);
  const marker=JSON.parse(await readFile(join(directory,winner.approvalId+'.used'),'utf8'));
  assert.equal(marker.metadata.restoreChecksum,point.checksum);
  assert.equal(marker.metadata.historyHash,entries[0].hash);
  assert.equal(results.every(r=>r.executesRestore===false),true);
 }finally{await rm(directory,{recursive:true,force:true});}
});
