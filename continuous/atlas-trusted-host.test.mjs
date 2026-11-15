import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 createAtlasProposalId,createAtlasTrustedHost,validateAtlasCanonicalPaths
} from './atlas-trusted-host.mjs';

const approvalId='123e4567-e89b-42d3-a456-426614174001';
const commitSha='a'.repeat(40),baseSha='b'.repeat(40),diffSha256='c'.repeat(64);

async function fixture(t,overrides={}){
 const root=await mkdtemp(join(tmpdir(),'atlas-trusted-host-'));
 const approvalDirectory=join(root,'approvals');
 await mkdir(join(root,'src'));
 await mkdir(approvalDirectory,{mode:0o700});
 await writeFile(join(root,'src','main.mjs'),'export const x=1;');
 t.after(()=>rm(root,{recursive:true,force:true}));
 const calls=[];
 const host=createAtlasTrustedHost({
  repositoryRoot:root,repository:'owner/repo',approvalDirectory,
  resolveGitHubCommit:async({commitSha:sha})=>sha,
  verifyApproval:async context=>context.commitSha===commitSha&&context.diffSha256===diffSha256,
  readBranchHead:async()=>baseSha,
  publishCommit:async()=>({commitSha}),
  rollbackBranch:async()=>true,
  ...overrides
 });
 return {root,approvalDirectory,host,calls};
}

test('proposal IDs are UUIDs and canonical path checks reject symlinks',async t=>{
 const {root}=await fixture(t);
 assert.match(createAtlasProposalId(),/^[0-9a-f-]{36}$/i);
 assert.deepEqual(await validateAtlasCanonicalPaths({
  repositoryRoot:root,paths:['src/main.mjs']
 }),[join(root,'src','main.mjs')]);
 await symlink(join(root,'src'),join(root,'linked-src'));
 await assert.rejects(validateAtlasCanonicalPaths({
  repositoryRoot:root,paths:['linked-src/main.mjs']
 }),/Symlinked/);
});

test('host rejects a non-matching upstream commit before approval',async t=>{
 const {host}=await fixture(t,{
  resolveGitHubCommit:async()=>baseSha,
  verifyApproval:async()=>{throw Error('must not inspect approval')}
 });
 await assert.rejects(host.createProposal({
  commitSha,diffSha256,paths:['src/main.mjs']
 }),/SHA mismatch/);
});

test('approval is bound to the proposal, diff, commit and branch and consumed once',async t=>{
 const {host}=await fixture(t);
 const proposal=await host.createProposal({commitSha,diffSha256,paths:['src/main.mjs']});
 await assert.rejects(host.verifyProposal({
  proposalId:proposal.proposalId,commitSha,diffSha256:'d'.repeat(64),paths:['src/main.mjs']
 }),/binding mismatch/);
 await assert.rejects(host.verifyProposal({
  proposalId:proposal.proposalId,commitSha,diffSha256,paths:['src/other.mjs']
 }),/Canonical path|path does not exist|binding mismatch/);
 const request={approvalId,proposalId:proposal.proposalId,commitSha,diffSha256,branch:'copilot/change',
  expectedBaseSha:baseSha,paths:['src/main.mjs']};
 const first=await host.consumeApproval(request);
 const second=await host.consumeApproval(request);
 assert.equal(first.consumed,true);
 assert.equal(second.consumed,false);
 assert.equal(first.approvalContext.proposalId,proposal.proposalId);
 assert.equal(first.approvalContext.diffSha256,diffSha256);
});

test('publishes only from the expected branch head and requests rollback after failure',async t=>{
 const {host}=await fixture(t);
 const proposal=await host.createProposal({commitSha,diffSha256,paths:['src/main.mjs']});
 const success=await host.publishApprovedChange({
  approvalId,proposalId:proposal.proposalId,commitSha,diffSha256,branch:'copilot/change',
  expectedBaseSha:baseSha,paths:['src/main.mjs']
 });
 assert.equal(success.status,'published');
 assert.equal(success.commitSha,commitSha);

 const failed=await fixture(t,{
  publishCommit:async()=>{throw Error('publish failed');}
 });
 const failedProposal=await failed.host.createProposal({commitSha,diffSha256,paths:['src/main.mjs']});
 const rollback=await failed.host.publishApprovedChange({
  approvalId,proposalId:failedProposal.proposalId,commitSha,diffSha256,branch:'copilot/change',
  expectedBaseSha:baseSha,paths:['src/main.mjs']
 });
 assert.equal(rollback.status,'rolled_back');
 assert.equal(rollback.rollbackConfirmed,true);
});

test('does not consume or publish on branch compare-and-swap mismatch',async t=>{
 const {host}=await fixture(t,{readBranchHead:async()=>commitSha});
 const proposal=await host.createProposal({commitSha,diffSha256,paths:['src/main.mjs']});
 const result=await host.publishApprovedChange({
  approvalId,proposalId:proposal.proposalId,commitSha,diffSha256,branch:'copilot/change',
  expectedBaseSha:baseSha,paths:['src/main.mjs']
 });
 assert.equal(result.status,'branch_precondition_failed');
});
