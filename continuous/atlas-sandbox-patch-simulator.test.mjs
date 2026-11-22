import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareAtlasSandboxPatch} from './atlas-sandbox-patch-preflight.mjs';
import {simulateAtlasSandboxPatch} from './atlas-sandbox-patch-simulator.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const baseRevision='a'.repeat(40);
test('stages update, create and delete without changing caller snapshot',()=>{
 const snapshot={'src/a.mjs':'before','src/old.mjs':'obsolete'};
 const proposal=prepareAtlasSandboxPatch({proposalId:'safe-1',baseRevision,
  files:[
   {operation:'update',path:'src/a.mjs',content:'after'},
   {operation:'create',path:'src/new.mjs',content:'new'},
   {operation:'delete',path:'src/old.mjs'}
  ],expectedCurrent:{
   'src/a.mjs':sha('before'),'src/old.mjs':sha('obsolete')
  }});
 const result=simulateAtlasSandboxPatch({proposal,currentRevision:baseRevision,snapshot});
 assert.deepEqual(result.snapshot,{'src/a.mjs':'after','src/new.mjs':'new'});
 assert.equal(snapshot['src/a.mjs'],'before');
 assert.equal(result.diskWritten,false);
 assert.equal(result.commandsExecuted,false);
 assert.equal(result.testsExecuted,false);
});
test('refuses drift and missing base files',()=>{
 const proposal=prepareAtlasSandboxPatch({proposalId:'safe-2',baseRevision,
  files:[{operation:'update',path:'src/a.mjs',content:'after'}],
  expectedCurrent:{'src/a.mjs':sha('before')}});
 assert.throws(()=>simulateAtlasSandboxPatch({
  proposal,currentRevision:baseRevision,snapshot:{'src/a.mjs':'changed'}
 }),/file drift/);
 assert.throws(()=>simulateAtlasSandboxPatch({
  proposal,currentRevision:baseRevision,snapshot:{}
 }),/file drift/);
});
