import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendAtlasHistoryWithLock} from './atlas-locked-evaluation-history.mjs';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
const record={baselineId:'base',candidateId:'candidate',
 recommendation:'reject_candidate',qualityDelta:0,
 baselineLatencyMs:10,candidateLatencyMs:12,
 newFailures:[],latencyWithinLimit:true};
test('appends under lock and removes lock after success',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-lock-'));
 const filePath=join(dir,'history.json');
 try{
  const result=await appendAtlasHistoryWithLock({
   filePath,expectedHeadHash:null,
   buildEntries:entries=>appendAtlasEvaluationHistory({
    entries,record,timestamp:100
   })
  });
  assert.equal(result.count,1);
  const entries=JSON.parse(await readFile(filePath,'utf8'));
  assert.equal(entries.length,1);
  await assert.rejects(readFile(filePath+'.lock'),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('refuses existing lock without overwriting it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-lock-'));
 const filePath=join(dir,'history.json');
 try{
  await writeFile(filePath+'.lock','another writer');
  await assert.rejects(appendAtlasHistoryWithLock({
   filePath,expectedHeadHash:null,buildEntries:()=>[]
  }),/History locked/);
  assert.equal(await readFile(filePath+'.lock','utf8'),'another writer');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('removes lock on failed append',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-lock-'));
 const filePath=join(dir,'history.json');
 try{
  await assert.rejects(appendAtlasHistoryWithLock({
   filePath,expectedHeadHash:null,buildEntries:()=>{throw Error('bad proposal');}
  }),/bad proposal/);
  await assert.rejects(readFile(filePath+'.lock'),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
