import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {planAtlasContainerChecks} from './atlas-container-check-plan.mjs';
import {runAtlasContainerCheck} from './atlas-container-check-runner.mjs';
const plan=planAtlasContainerChecks({
 workspacePath:'/tmp/atlas-test',imageDigest:'node@sha256:'+'a'.repeat(64)
});
function fakeSpawn(runtime,argv,options){
 assert.equal(runtime,'podman');
 assert.equal(options.shell,false);
 const child=new EventEmitter();
 child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 child.kill=()=>{};
 queueMicrotask(()=>{child.stdout.emit('data',Buffer.from('ok'));
  child.emit('close',0,null);});
 return child;
}
test('runs validated plan through injected host adapter',async()=>{
 const result=await runAtlasContainerCheck({plan,spawn:fakeSpawn,timeoutMs:1000});
 assert.equal(result.status,'passed');
 assert.equal(result.stdout,'ok');
 assert.equal(result.sandboxAttested,false);
});
test('refuses tampered arguments',async()=>{
 await assert.rejects(runAtlasContainerCheck({
  plan:{...plan,argv:[...plan.argv,'--privileged']},
  spawn:fakeSpawn
 }),/not trusted/);
});
