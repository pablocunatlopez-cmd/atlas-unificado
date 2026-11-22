import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {atlasApprovalMessage} from './atlas-signed-restore-approval.mjs';
import {assessAtlasApprovalReplay} from './atlas-restore-approval-replay-gate.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const nowMs=1000000;
const unsigned={actorId:'operator',historyHash:'a'.repeat(64),
 restoreChecksum:'b'.repeat(64),approvedAt:nowMs};
const approval={...unsigned,signature:sign(null,
 atlasApprovalMessage(unsigned),privateKey).toString('base64')};
const args={approval,publicKey,expectedActorId:'operator',
 consumedApprovalIds:[],nowMs};
test('valid signed approval requires atomic host consumption',()=>{
 const result=assessAtlasApprovalReplay(args);
 assert.equal(result.status,'eligible_for_atomic_host_consumption');
 assert.equal(result.consumptionPersisted,false);
 assert.equal(assessAtlasApprovalReplay({...args,
  consumedApprovalIds:[result.approvalId]}).reason,'approval_already_consumed');
});
test('expired and future approvals are blocked',()=>{
 assert.equal(assessAtlasApprovalReplay({...args,nowMs:nowMs+300001}).reason,'approval_expired');
 assert.equal(assessAtlasApprovalReplay({...args,nowMs:nowMs-30001}).reason,'approval_from_future');
});
test('wrong identity or tampered signature fails closed',()=>{
 assert.throws(()=>assessAtlasApprovalReplay({...args,
  expectedActorId:'intruder'}));
 assert.throws(()=>assessAtlasApprovalReplay({...args,
  approval:{...approval,approvedAt:nowMs-100}}));
});
test('requires trusted replay context',()=>{
 assert.throws(()=>assessAtlasApprovalReplay({...args,
  consumedApprovalIds:undefined}),/trusted replay context/);
});
