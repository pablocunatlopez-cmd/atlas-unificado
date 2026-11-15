import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasPatch} from './atlas-patch-planner.mjs';
test('produces bounded non-executing patch plan',()=>{
 const plan=planAtlasPatch({proposalId:'change-1',files:[{operation:'create',path:'continuous/example.mjs',content:'export const x=1;'}]});
 assert.equal(plan.executionStatus,'not_executed');
 assert.equal(plan.changes[0].operation,'create');
 assert.equal(plan.requiresReview,true);
});
test('rejects traversal, duplicate paths and forbidden internals',()=>{
 for(const path of ['../secret','a/../b','.git/config','node_modules/pkg','/root/a','a\\b']){
  assert.throws(()=>planAtlasPatch({proposalId:'x',files:[{operation:'create',path,content:'x'}]}));
 }
 assert.throws(()=>planAtlasPatch({proposalId:'x',files:[
  {operation:'create',path:'a.mjs',content:'a'},
  {operation:'update',path:'a.mjs',content:'b'}]}));
});
test('rejects oversize and invalid delete payload',()=>{
 assert.throws(()=>planAtlasPatch({proposalId:'x',files:[{operation:'create',path:'a.mjs',content:'x'.repeat(250001)}]}));
 assert.throws(()=>planAtlasPatch({proposalId:'x',files:[{operation:'delete',path:'a.mjs',content:'oops'}]}));
});
