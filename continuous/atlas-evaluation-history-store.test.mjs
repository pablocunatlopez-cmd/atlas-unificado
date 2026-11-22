import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {readAtlasEvaluationHistoryFile,writeAtlasEvaluationHistoryFile} from './atlas-evaluation-history-store.mjs';
const record={baselineId:'a',candidateId:'b',
 recommendation:'eligible_for_human_review',qualityDelta:0.5,
 baselineLatencyMs:100,candidateLatencyMs:110,
 newFailures:[],latencyWithinLimit:true};
test('persists and reloads verified history with expected head',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-history-'));
 const filePath=join(dir,'history.json');
 try{
  const missing=await readAtlasEvaluationHistoryFile({filePath});
  assert.equal(missing.exists,false);
  const entries=appendAtlasEvaluationHistory({record,timestamp:1000});
  await writeAtlasEvaluationHistoryFile({filePath,entries,expectedHeadHash:null});
  const loaded=await readAtlasEvaluationHistoryFile({filePath});
  assert.equal(loaded.entries[0].hash,entries[0].hash);
  await assert.rejects(writeAtlasEvaluationHistoryFile({
   filePath,entries:[],expectedHeadHash:null
  }),/changed since last read/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects corrupt on-disk history without replacing it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-history-'));
 const filePath=join(dir,'history.json');
 try{
  await writeFile(filePath,'[{"bad":true}]');
  await assert.rejects(readAtlasEvaluationHistoryFile({filePath}));
  assert.equal(await readFile(filePath,'utf8'),'[{"bad":true}]');
 }finally{await rm(dir,{recursive:true,force:true});}
});
