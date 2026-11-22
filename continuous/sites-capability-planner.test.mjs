import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSitesTask} from './sites-capability-planner.mjs';

test('never grants capabilities that Sites host did not provide',()=>{
 const plan=planSitesTask({goal:'Improve Atlas',capabilities:['retrieve_memory','draft_change']});
 assert.deepEqual(plan.actions,['retrieve_memory','draft_change']);
 assert.ok(plan.missingCapabilities.includes('evaluate_change'));
 assert.equal(plan.autoDeploy,false);
 assert.equal(plan.requiresApproval,true);
});
test('no available capabilities means blocked, not invented execution',()=>{
 const plan=planSitesTask({goal:'Improve Atlas'});
 assert.equal(plan.status,'blocked');
 assert.deepEqual(plan.actions,[]);
});
test('respects bounded action count',()=>{
 const plan=planSitesTask({goal:'Review',maxActions:1,
  capabilities:['retrieve_memory','research','draft_change','evaluate_change','request_approval']});
 assert.deepEqual(plan.actions,['retrieve_memory']);
});
test('rejects malformed capability and oversized goals',()=>{
 assert.throws(()=>planSitesTask({goal:'x',capabilities:['shell;rm']}));
 assert.throws(()=>planSitesTask({goal:'x'.repeat(4001)}));
});
