import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasIsolatedRun} from './atlas-isolated-run-plan.mjs';
import {buildAtlasDockerInvocation} from './atlas-docker-invocation.mjs';
const plan=planAtlasIsolatedRun({proposalId:'test',commitSha:'a'.repeat(40)});
const image='node@sha256:'+'b'.repeat(64);
test('Docker invocation disables network and privileges and binds workspace read-only',()=>{
 const run=buildAtlasDockerInvocation({plan,image,workspacePath:'/verified/atlas'});
 assert.equal(run.execute,false);
 assert.equal(run.command,'docker');
 for(const flag of ['--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pull=never'])
  assert.ok(run.args.includes(flag));
 assert.ok(run.args.includes('--mount=type=bind,src=/verified/atlas,dst=/workspace,readonly'));
 assert.deepEqual(run.args.slice(-2),['npm','test']);
});
test('rejects unpinned images and ambiguous paths',()=>{
 for(const candidate of ['node:22','node@sha256:abc','']){
  assert.throws(()=>buildAtlasDockerInvocation({plan,image:candidate,workspacePath:'/verified/atlas'}));
 }
 for(const workspacePath of ['/verified/../secret','relative','/verified//atlas']){
  assert.throws(()=>buildAtlasDockerInvocation({plan,image,workspacePath}));
 }
});
