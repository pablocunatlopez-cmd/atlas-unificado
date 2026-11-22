import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {atlasApprovalMessage,verifyAtlasSignedApproval} from './atlas-signed-restore-approval.mjs';
test('verifies approval signed by trusted Ed25519 key',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const approval={historyHash:'a'.repeat(64),restoreChecksum:'b'.repeat(64),
  actorId:'operator-1',approvedAt:1000};
 const signature=sign(null,atlasApprovalMessage(approval),privateKey).toString('base64');
 const result=verifyAtlasSignedApproval({approval:{...approval,signature},
  publicKey,expectedActorId:'operator-1'});
 assert.equal(result.signatureVerified,true);
 assert.equal(result.actorAuthorized,'host_must_verify');
 assert.throws(()=>verifyAtlasSignedApproval({
  approval:{...approval,restoreChecksum:'c'.repeat(64),signature},
  publicKey,expectedActorId:'operator-1'
 }),/signature invalid/);
});
test('rejects approval for a different actor',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const approval={historyHash:'a'.repeat(64),restoreChecksum:'b'.repeat(64),
  actorId:'operator-1',approvedAt:1000};
 const signature=sign(null,atlasApprovalMessage(approval),privateKey).toString('base64');
 assert.throws(()=>verifyAtlasSignedApproval({
  approval:{...approval,signature},publicKey,expectedActorId:'operator-2'
 }),/Invalid signed approval/);
});
