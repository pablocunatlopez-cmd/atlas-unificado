import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {atlasHistoryAnchorMessage} from './atlas-history-signed-anchor.mjs';
import {verifyAtlasHistoryContinuity} from './atlas-history-continuity-gate.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const scope='atlas/production';
const record={baselineId:'base',candidateId:'candidate',
 recommendation:'reject_candidate',qualityDelta:0,
 baselineLatencyMs:10,candidateLatencyMs:12,
 newFailures:[],latencyWithinLimit:true};
const first=appendAtlasEvaluationHistory({record,timestamp:100});
const second=appendAtlasEvaluationHistory({entries:first,record,timestamp:101});
const checkpoint={scope,count:1,headHash:first[0].hash};
const signed=entries=>{
 const unsigned={scope,count:entries.length,headHash:entries.at(-1).hash};
 return {...unsigned,signature:sign(null,
  atlasHistoryAnchorMessage(unsigned),privateKey).toString('base64')};
};
test('accepts signed history extending independently trusted checkpoint',()=>{
 const result=verifyAtlasHistoryContinuity({entries:second,
  anchor:signed(second),publicKey,expectedScope:scope,
  trustedCheckpoint:checkpoint});
 assert.equal(result.continuityVerified,true);
 assert.equal(result.signerAuthorizationVerified,false);
});
test('rejects rollback despite valid signature',()=>{
 assert.throws(()=>verifyAtlasHistoryContinuity({entries:first,
  anchor:signed(first),publicKey,expectedScope:scope,
  trustedCheckpoint:{scope,count:2,headHash:second[1].hash}
 }),/rollback/);
});
test('rejects divergent history even with a valid signature',()=>{
 const other=appendAtlasEvaluationHistory({record,timestamp:999});
 assert.throws(()=>verifyAtlasHistoryContinuity({entries:other,
  anchor:signed(other),publicKey,expectedScope:scope,
  trustedCheckpoint:checkpoint
 }),/diverges/);
});
test('requires externally supplied checkpoint',()=>{
 assert.throws(()=>verifyAtlasHistoryContinuity({entries:second,
  anchor:signed(second),publicKey,expectedScope:scope
 }),/checkpoint required/);
});
