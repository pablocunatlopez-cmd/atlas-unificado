import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyAtlasRestoreRevision} from './atlas-restore-revision-check.mjs';
test('checks exact commit without performing checkout',async()=>{
 const sha='a'.repeat(40);
 let requested=null;
 const result=await verifyAtlasRestoreRevision({
  revision:sha,lookupCommit:async revision=>{requested=revision;return {sha:revision};}
 });
 assert.equal(requested,sha);
 assert.equal(result.verified,true);
});
test('rejects mismatched commit identity',async()=>{
 const result=await verifyAtlasRestoreRevision({
  revision:'a'.repeat(40),lookupCommit:async()=>({sha:'b'.repeat(40)})
 });
 assert.equal(result.verified,false);
});
