import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {consumeAtlasApprovalOnce} from './atlas-approval-consumption-store.mjs';
import {auditAtlasApprovalMarkers} from './atlas-approval-marker-audit.mjs';
const id='a'.repeat(64),partial='b'.repeat(64);
test('audit reports valid markers and never changes them',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-audit-'));
 try{
  await consumeAtlasApprovalOnce({directory,approvalId:id});
  const before=await readFile(join(directory,id+'.used'),'utf8');
  const audit=await auditAtlasApprovalMarkers({directory});
  assert.equal(audit.status,'audit_clean');
  assert.equal(audit.checked,1);
  assert.equal(await readFile(join(directory,id+'.used'),'utf8'),before);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('partial marker is retained and blocks replay',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-audit-'));
 try{
  await writeFile(join(directory,partial+'.used'),'{"version":1');
  await chmod(join(directory,partial+'.used'),0o600);
  const audit=await auditAtlasApprovalMarkers({directory});
  assert.equal(audit.status,'requires_human_review');
  assert.equal(audit.findings[0].status,'invalid_or_partial_marker');
  const result=await consumeAtlasApprovalOnce({directory,approvalId:partial});
  assert.equal(result.status,'already_consumed');
  assert.equal(await readFile(join(directory,partial+'.used'),'utf8'),'{"version":1');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('unexpected entries are flagged rather than removed',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-audit-'));
 try{
  await writeFile(join(directory,'unexpected.txt'),'x');
  const audit=await auditAtlasApprovalMarkers({directory});
  assert.equal(audit.status,'requires_human_review');
  assert.equal(audit.findings[0].status,'unexpected_entry');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('symlinked marker is reported unsafe without reading target',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-audit-link-'));
 try{
  const {symlink}=await import('node:fs/promises');
  const target=join(directory,'target.txt');
  await writeFile(target,'sensitive');
  await symlink(target,join(directory,'c'.repeat(64)+'.used'));
  const audit=await auditAtlasApprovalMarkers({directory});
  assert.equal(audit.status,'requires_human_review');
  assert.equal(audit.findings.find(f=>f.name.endsWith('.used')).status,
   'unsafe_or_unreadable_marker');
 }finally{await rm(directory,{recursive:true,force:true});}
});
