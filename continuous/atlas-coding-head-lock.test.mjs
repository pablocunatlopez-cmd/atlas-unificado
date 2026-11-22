import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyAtlasCodingHeadUnderLock} from './atlas-coding-head-lock.mjs';
const commit='a'.repeat(40);
test('checks HEAD while host lock callback is active',async()=>{
 let held=false;
 const result=await verifyAtlasCodingHeadUnderLock({
  expectedBaseCommit:commit,readHeadCommit:async()=>{assert.equal(held,true);return commit;},
  withRepositoryLock:async callback=>{held=true;try{return await callback();}finally{held=false;}}
 });
 assert.equal(result.status,'head_matches_under_lock');
 assert.equal(result.executesCode,false);
});
test('stale HEAD is rejected under lock',async()=>{
 const result=await verifyAtlasCodingHeadUnderLock({expectedBaseCommit:commit,
  readHeadCommit:async()=> 'b'.repeat(40),
  withRepositoryLock:callback=>callback()});
 assert.equal(result.reason,'stale_base_commit');
});
test('untrusted lock or reader is rejected',async()=>{
 await assert.rejects(()=>verifyAtlasCodingHeadUnderLock({
  expectedBaseCommit:commit,readHeadCommit:async()=>commit
 }),/Trusted repository lock/);
});
