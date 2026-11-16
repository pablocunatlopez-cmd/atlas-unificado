import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recordAtlasCodingIntent} from './atlas-coding-intent-log.mjs';
const base={transactionId:'tx1',proposalId:'task1',baseCommit:'a'.repeat(40),diffDigest:'b'.repeat(64)};
test('durable intent is idempotent and rejects reused IDs for different patches',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-intent-'));
 try{
  const args={...base,directory:dir};
  assert.equal((await recordAtlasCodingIntent(args)).status,'intent_recorded');
  assert.equal((await recordAtlasCodingIntent(args)).status,'already_recorded');
  assert.equal((await recordAtlasCodingIntent({...args,diffDigest:'c'.repeat(64)})).status,'transaction_id_conflict');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('concurrent duplicate intent writers cannot create multiple entries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-intent-'));
 try{
  const results=await Promise.all(Array.from({length:8},()=>recordAtlasCodingIntent({...base,directory:dir})));
  assert.equal(results.filter(r=>r.status==='intent_recorded').length,1);
  assert.equal(results.filter(r=>r.status==='already_recorded').length,7);
 }finally{await rm(dir,{recursive:true,force:true});}
});
