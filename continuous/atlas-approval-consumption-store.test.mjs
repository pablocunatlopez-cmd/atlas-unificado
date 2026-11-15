import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {consumeAtlasApprovalOnce} from './atlas-approval-consumption-store.mjs';
const approvalId='a'.repeat(64);
test('concurrent claims permit only one consumption',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-approval-'));
 try{
  const results=await Promise.all(Array.from({length:12},()=>
   consumeAtlasApprovalOnce({directory,approvalId,metadata:{actor:'operator'}})));
  assert.equal(results.filter(r=>r.consumed).length,1);
  assert.equal(results.filter(r=>r.status==='already_consumed').length,11);
  const marker=JSON.parse(await readFile(join(directory,approvalId+'.used'),'utf8'));
  assert.equal(marker.approvalId,approvalId);
  assert.equal(marker.metadata.actor,'operator');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('rejects invalid approval IDs before writing',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-approval-'));
 try{
  await assert.rejects(consumeAtlasApprovalOnce({directory,approvalId:'../escape'}));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('refuses an approval directory accessible by other users',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-approval-public-'));
 try{
  const {chmod}=await import('node:fs/promises');
  await chmod(directory,0o755);
  await assert.rejects(consumeAtlasApprovalOnce({directory,approvalId}),
   /directory must be private/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('existing marker remains consumed after a new call',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-approval-restart-'));
 try{
  assert.equal((await consumeAtlasApprovalOnce({directory,approvalId})).consumed,true);
  const again=await consumeAtlasApprovalOnce({directory,approvalId});
  assert.equal(again.status,'already_consumed');
 }finally{await rm(directory,{recursive:true,force:true});}
});
