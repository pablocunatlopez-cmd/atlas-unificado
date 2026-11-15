import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {createAtlasRestorePoint} from './atlas-restore-point.mjs';
import {atlasApprovalMessage} from './atlas-signed-restore-approval.mjs';
import {assessAtlasRestoreSafety} from './atlas-restore-safety-gate.mjs';
const revision='a'.repeat(40),currentRevision='b'.repeat(40);
const entries=appendAtlasEvaluationHistory({timestamp:1,record:{
 baselineId:'old',candidateId:'candidate',
 recommendation:'eligible_for_human_review',qualityDelta:0.5,
 baselineLatencyMs:100,candidateLatencyMs:110,
 newFailures:[],latencyWithinLimit:true
}});
const point=createAtlasRestorePoint({revision,config:{modelId:'candidate'},
 historyHeadHash:entries[0].hash,createdAt:1});
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const approval={historyHash:entries[0].hash,restoreChecksum:point.checksum,
 actorId:'operator',approvedAt:2};
const signedApprovals=[{...approval,
 signature:sign(null,atlasApprovalMessage(approval),privateKey).toString('base64')}];
const base={entries,restorePoints:[point],signedApprovals,
 publicKey,expectedActorId:'operator',currentRevision};
test('signed approval plus matching Git revision yields review only',async()=>{
 const result=await assessAtlasRestoreSafety({...base,
  lookupCommit:async sha=>({sha})});
 assert.equal(result.status,'ready_for_additional_human_review');
 assert.equal(result.executesRestore,false);
 assert.equal(result.actorAuthorizationVerified,false);
});
test('rejects unknown Git revision',async()=>{
 const result=await assessAtlasRestoreSafety({...base,
  lookupCommit:async()=>null});
 assert.equal(result.reason,'revision_not_verified');
});
test('rejects tampered signed approval',async()=>{
 await assert.rejects(assessAtlasRestoreSafety({...base,
  signedApprovals:[{...signedApprovals[0],restoreChecksum:'f'.repeat(64)}],
  lookupCommit:async sha=>({sha})}),/signature invalid/);
});
