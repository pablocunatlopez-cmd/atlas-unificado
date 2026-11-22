import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAtlasCodingIntentRecord,isAtlasCodingIntentFileInfo,MAX_ATLAS_INTENT_BYTES} from './atlas-coding-intent-schema.mjs';
const valid={schemaVersion:1,transactionId:'tx',proposalId:'p',baseCommit:'a'.repeat(40),diffDigest:'b'.repeat(64),status:'intent_recorded_no_commit_claim'};
test('strict shared record schema rejects unexpected fields and malformed IDs',()=>{
 assert.equal(isAtlasCodingIntentRecord(valid),true);
 assert.equal(isAtlasCodingIntentRecord({...valid,extra:1}),false);
 assert.equal(isAtlasCodingIntentRecord({...valid,transactionId:'../tx'}),false);
 assert.equal(isAtlasCodingIntentRecord({...valid,status:'committed'}),false);
});
test('shared file validation rejects nonprivate, oversized and nonregular files',()=>{
 const file={isFile:()=>true,mode:0o100600,size:100};
 assert.equal(isAtlasCodingIntentFileInfo(file),true);
 assert.equal(isAtlasCodingIntentFileInfo({...file,mode:0o100644}),false);
 assert.equal(isAtlasCodingIntentFileInfo({...file,size:MAX_ATLAS_INTENT_BYTES+1}),false);
 assert.equal(isAtlasCodingIntentFileInfo({...file,isFile:()=>false}),false);
});
