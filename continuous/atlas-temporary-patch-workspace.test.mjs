import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {prepareAtlasSandboxPatch} from './atlas-sandbox-patch-preflight.mjs';
import {materializeAtlasPatchWorkspace} from './atlas-temporary-patch-workspace.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const baseRevision='a'.repeat(40);
test('writes only temporary verified files and cleans up',async()=>{
 const proposal=prepareAtlasSandboxPatch({proposalId:'tmp-1',baseRevision,
  files:[{operation:'update',path:'src/main.mjs',content:'after'}],
  expectedCurrent:{'src/main.mjs':sha('before')}});
 const workspace=await materializeAtlasPatchWorkspace({
  proposal,currentRevision:baseRevision,snapshot:{'src/main.mjs':'before'}});
 try{
  assert.equal(await readFile(join(workspace.root,'src/main.mjs'),'utf8'),'after');
  assert.equal(workspace.commandsExecuted,false);
  assert.equal(workspace.osSandboxed,false);
 }finally{await workspace.cleanup();}
 await assert.rejects(stat(workspace.root),{code:'ENOENT'});
 await workspace.cleanup();
});
test('does not create workspace when file drift detected',async()=>{
 const proposal=prepareAtlasSandboxPatch({proposalId:'tmp-2',baseRevision,
  files:[{operation:'update',path:'src/main.mjs',content:'after'}],
  expectedCurrent:{'src/main.mjs':sha('before')}});
 await assert.rejects(materializeAtlasPatchWorkspace({
  proposal,currentRevision:baseRevision,snapshot:{'src/main.mjs':'changed'}
 }),/file drift/);
});
