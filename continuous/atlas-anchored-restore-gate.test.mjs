import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {atlasHistoryAnchorMessage} from './atlas-history-signed-anchor.mjs';
import {assessAtlasAnchoredRestore} from './atlas-anchored-restore-gate.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const scope='atlas/test';
const record={baselineId:'base',candidateId:'candidate',
 recommendation:'reject_candidate',qualityDelta:0,
 baselineLatencyMs:10,candidateLatencyMs:12,
 newFailures:[],latencyWithinLimit:true};
const entries=appendAtlasEvaluationHistory({record,timestamp:100});
const unsigned={scope,count:1,headHash:entries[0].hash};
const anchor={...unsigned,signature:sign(null,
 atlasHistoryAnchorMessage(unsigned),privateKey).toString('base64')};
const args={entries,anchor,anchorPublicKey:publicKey,
 expectedScope:scope,trustedCheckpoint:unsigned,
 restorePoints:[],signedApprovals:[],approvalPublicKey:publicKey,
 expectedActorId:'operator',currentRevision:'a'.repeat(40),
 lookupCommit:async()=>null};
test('refuses restore review when actor authorization fails',async()=>{
 const result=await assessAtlasAnchoredRestore({...args,
  authorizeActor:async()=>false});
 assert.equal(result.reason,'actor_not_authorized');
 assert.equal(result.executesRestore,false);
});
test('requires host authorization callback',async()=>{
 await assert.rejects(assessAtlasAnchoredRestore(args),/authorization callback/);
});
test('rejects tampered history before actor authorization',async()=>{
 let invoked=false;
 await assert.rejects(assessAtlasAnchoredRestore({...args,
  entries:appendAtlasEvaluationHistory({record,timestamp:200}),
  authorizeActor:async()=>{invoked=true;return true;}
 }),/does not match trusted context/);
 assert.equal(invoked,false);
});
test('verified actor cannot bypass missing signed restore approval',async()=>{
 const result=await assessAtlasAnchoredRestore({...args,
  authorizeActor:async()=>true});
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'no_approved_candidate');
 assert.equal(result.executesRestore,false);
});
