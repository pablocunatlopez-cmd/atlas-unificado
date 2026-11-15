import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasIsolatedRun} from './atlas-isolated-run-plan.mjs';
const commitSha='a'.repeat(40);
test('produces a bounded execution contract without authorizing execution',()=>{
 const plan=planAtlasIsolatedRun({commitSha,proposalId:'test-1',files:['src/main.mjs']});
 assert.equal(plan.status,'requires_trusted_isolated_executor');
 assert.equal(plan.executionAuthorized,false);
 assert.equal(plan.requirements.network,'disabled');
 assert.equal(plan.requirements.hostSecrets,'none');
});
test('rejects traversal, protected files and duplicate targets',()=>{
 for(const files of [['../secret'],['/etc/passwd'],['.git/config'],['node_modules/pkg'],['src//a'],['src/a','src/a']]){
  assert.throws(()=>planAtlasIsolatedRun({commitSha,proposalId:'test-1',files}));
 }
});
test('rejects invalid budgets and unsupported run modes',()=>{
 assert.throws(()=>planAtlasIsolatedRun({commitSha,proposalId:'test-1',limits:{timeoutMs:999}}));
 assert.throws(()=>planAtlasIsolatedRun({commitSha,proposalId:'test-1',mode:'shell'}));
 assert.throws(()=>planAtlasIsolatedRun({commitSha:'bad',proposalId:'test-1'}));
});
