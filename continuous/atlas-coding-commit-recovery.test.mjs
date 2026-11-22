import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectAtlasCodingCommitRecovery} from './atlas-coding-commit-recovery.mjs';
const base='a'.repeat(40),next='b'.repeat(40);
for(const [head,status] of [[next,'new_commit_visible'],[base,'base_commit_visible'],['c'.repeat(40),'unexpected_head']]){
 test('recovery classifies '+status+' without automatic retry',async()=>{
  const r=await inspectAtlasCodingCommitRecovery({expectedBaseCommit:base,expectedNewCommit:next,
   readHeadCommit:async()=>head});
  assert.equal(r.status,status);assert.equal(r.retrySafe,false);
 });
}
