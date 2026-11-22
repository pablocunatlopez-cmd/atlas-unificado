import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {atlasHistoryAnchorMessage,verifyAtlasHistoryAnchor} from './atlas-history-signed-anchor.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const record={baselineId:'base',candidateId:'candidate',
 recommendation:'reject_candidate',qualityDelta:0,
 baselineLatencyMs:10,candidateLatencyMs:12,
 newFailures:[],latencyWithinLimit:true};
const entries=appendAtlasEvaluationHistory({record,timestamp:123});
const scope='atlas/test';
const unsigned={headHash:entries.at(-1).hash,count:entries.length,scope};
const anchor={...unsigned,signature:sign(null,
 atlasHistoryAnchorMessage(unsigned),privateKey).toString('base64')};
test('verifies external Ed25519 signature against history',()=>{
 const result=verifyAtlasHistoryAnchor({entries,anchor,publicKey,expectedScope:scope});
 assert.equal(result.status,'signature_verified');
 assert.equal(result.signerAuthorizationVerified,false);
});
test('rejects wrong scope, signature and rewritten chain',()=>{
 assert.throws(()=>verifyAtlasHistoryAnchor({
  entries,anchor,publicKey,expectedScope:'other'
 }));
 assert.throws(()=>verifyAtlasHistoryAnchor({
  entries,anchor:{...anchor,signature:Buffer.alloc(64).toString('base64')},
  publicKey,expectedScope:scope
 }));
 const rewritten=appendAtlasEvaluationHistory({record,timestamp:999});
 assert.throws(()=>verifyAtlasHistoryAnchor({
  entries:rewritten,anchor,publicKey,expectedScope:scope
 }));
});
