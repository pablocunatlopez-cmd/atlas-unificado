import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runAtlasDockerPlan} from './atlas-docker-runner.mjs';
import {planAtlasIsolatedRun} from './atlas-isolated-run-plan.mjs';
const plan=planAtlasIsolatedRun({commitSha:'a'.repeat(40),proposalId:'cycle',limits:{timeoutMs:1000,maxOutputBytes:1024}});
const image='node@sha256:'+'b'.repeat(64),workspacePath='/verified/atlas';
const fakeSpawn=(code=0,output='ok')=>()=> {
 const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 child.kill=()=>{queueMicrotask(()=>child.emit('close',null,'SIGKILL'));return true;};
 queueMicrotask(()=>{child.stdout.emit('data',Buffer.from(output));child.emit('close',code,null);});
 return child;
};
test('requires host verification before spawning',async()=>{
 let called=false;
 await assert.rejects(runAtlasDockerPlan({plan,image,workspacePath,spawn:()=>{called=true;}}),/host verification/i);
 assert.equal(called,false);
});
test('records successful execution but does not authorize promotion',async()=>{
 const report=await runAtlasDockerPlan({plan,image,workspacePath,hostVerified:true,spawn:fakeSpawn()});
 assert.equal(report.passed,true);
 assert.equal(report.status,'passed');
 assert.equal(report.attested,false);
 assert.equal(report.promotionAuthorized,false);
 assert.match(report.outputSha256,/^[a-f0-9]{64}$/);
});
test('fails closed on nonzero exit and oversized output',async()=>{
 const failed=await runAtlasDockerPlan({plan,image,workspacePath,hostVerified:true,spawn:fakeSpawn(2,'bad')});
 assert.equal(failed.passed,false);
 assert.equal(failed.status,'failed');
 const overflow=await runAtlasDockerPlan({plan,image,workspacePath,hostVerified:true,spawn:fakeSpawn(0,'x'.repeat(2000))});
 assert.equal(overflow.passed,false);
 assert.equal(overflow.outputOverflow,true);
 assert.equal(overflow.outputSha256,null);
 assert.equal(overflow.promotionAuthorized,false);
});

test('returns bounded failure when process does not confirm termination',async()=>{
 let killed=false;
 const spawn=()=>{
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  child.kill=()=>{killed=true;return false;};
  return child;
 };
 const report=await runAtlasDockerPlan({plan,image,workspacePath,hostVerified:true,spawn});
 assert.equal(killed,true);
 assert.equal(report.passed,false);
 assert.equal(report.timedOut,true);
 assert.equal(report.terminationUnconfirmed,true);
 assert.equal(report.status,'termination_unconfirmed');
 assert.equal(report.promotionAuthorized,false);
});
