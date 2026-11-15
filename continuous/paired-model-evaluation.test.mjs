import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparePairedRuns} from './paired-model-evaluation.mjs';
const runs=(passed)=>passed.map((value,i)=>({id:'task-'+i,passed:value,durationMs:100,ttftMs:50}));

test('matched passing tasks are accepted',()=>{
  const result=comparePairedRuns(runs([true,true]),runs([true,true]));
  assert.equal(result.accepted,true);
});
test('same aggregate quality cannot hide a regression in a specific task',()=>{
  const result=comparePairedRuns(runs([true,false]),runs([false,true]),{minPassRate:.5});
  assert.equal(result.accepted,false);
  assert.deepEqual(result.regressions,['task-0']);
  assert.deepEqual(result.improvements,['task-1']);
  assert.ok(result.reasons.includes('individual_task_regression'));
});
test('mismatched task IDs are rejected',()=>{
  const candidate=runs([true,true]);candidate[1].id='different';
  assert.throws(()=>comparePairedRuns(runs([true,true]),candidate),/identical task IDs/);
});
test('invalid observations cannot be compared',()=>{
  const candidate=runs([true]);candidate[0].durationMs=NaN;
  assert.throws(()=>comparePairedRuns(runs([true]),candidate));
});
