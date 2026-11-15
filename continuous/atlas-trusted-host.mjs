import {createHash,randomUUID} from 'node:crypto';
import {lstat} from 'node:fs/promises';
import {isAbsolute,parse,relative,resolve,sep} from 'node:path';
import {consumeAtlasApprovalOnce} from './atlas-approval-consumption-store.mjs';

const SHA=/^[a-f0-9]{40}$/i;
const DIGEST=/^[a-f0-9]{64}$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const uuid=value=>typeof value==='string'&&UUID.test(value);

async function assertNoSymlinkComponents(path){
 const parsed=parse(path);
 let current=parsed.root;
 const parts=path.slice(parsed.root.length).split(sep).filter(Boolean);
 for(const [index,part] of parts.entries()){
  current=resolve(current,part);
  let info;
  try{info=await lstat(current);}
  catch(error){
   if(error?.code==='ENOENT'&&index===parts.length-1)return {path:current,exists:false};
   throw Error('Canonical path does not exist');
  }
  if(info.isSymbolicLink())throw Error('Symlinked repository path rejected');
  if(index<parts.length-1&&!info.isDirectory())throw Error('Repository path component is not a directory');
  if(index===parts.length-1&&!info.isFile()&&!info.isDirectory())
   throw Error('Unsupported repository path type');
 }
 return {path:current,exists:true};
}

export function createAtlasProposalId(){return randomUUID();}

export async function validateAtlasCanonicalPaths({repositoryRoot,paths,allowMissingLeaves=false}={}){
 if(typeof repositoryRoot!=='string'||!isAbsolute(repositoryRoot)||!Array.isArray(paths)||
    paths.length<1||paths.length>500)throw Error('Invalid canonical path request');
 const root=resolve(repositoryRoot);
 const rootCheck=await assertNoSymlinkComponents(root);
 if(!rootCheck.exists)throw Error('Repository root does not exist');
 const rootInfo=await lstat(root);
 if(!rootInfo.isDirectory())throw Error('Repository root must be a directory');
 const validated=[];
 for(const candidate of paths){
  if(typeof candidate!=='string'||!candidate||candidate.includes('\\')||isAbsolute(candidate)||
     candidate.split('/').some(part=>!part||part==='.'||part==='..'))
   throw Error('Invalid repository-relative path');
  const target=resolve(root,candidate);
  const rel=relative(root,target);
  if(!rel||rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel))
   throw Error('Repository path escapes root');
  const checked=await assertNoSymlinkComponents(target);
  if(!checked.exists&&!allowMissingLeaves)throw Error('Repository path does not exist');
  if(!checked.exists){
   const parent=await lstat(resolve(target,'..'));
   if(!parent.isDirectory())throw Error('Missing repository path parent');
  }
  validated.push(target);
 }
 return Object.freeze(validated);
}

export function createAtlasTrustedHost({
 repositoryRoot,repository,approvalDirectory,resolveGitHubCommit,
 verifyApproval,readBranchHead,publishCommit,rollbackBranch
}={}){
 if(typeof repositoryRoot!=='string'||!isAbsolute(repositoryRoot)||
    typeof repository!=='string'||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)||
    typeof approvalDirectory!=='string'||!approvalDirectory||
    typeof resolveGitHubCommit!=='function'||typeof verifyApproval!=='function'||
    typeof readBranchHead!=='function'||typeof publishCommit!=='function'||
    typeof rollbackBranch!=='function')
  throw Error('Trusted host adapters are required');

 const proposals=new Map();

 async function createProposal({commitSha,diffSha256,paths=[]}={}){
  if(typeof commitSha!=='string'||!SHA.test(commitSha)||
     typeof diffSha256!=='string'||!DIGEST.test(diffSha256))
   throw Error('Invalid proposal commit or diff digest');
  const canonicalPaths=await validateAtlasCanonicalPaths({repositoryRoot,paths});
  const upstream=await resolveGitHubCommit({repository,commitSha});
  if(typeof upstream!=='string'||upstream.toLowerCase()!==commitSha.toLowerCase())
   throw Error('GitHub commit SHA mismatch');
  const proposalId=randomUUID();
  const binding=Object.freeze({
   proposalId,repository,commitSha:commitSha.toLowerCase(),
   diffSha256:diffSha256.toLowerCase(),paths:canonicalPaths
  });
  proposals.set(proposalId,binding);
  return Object.freeze({...binding,status:'proposal_commit_paths_verified'});
 }

 async function verifyProposal({proposalId,commitSha,diffSha256,paths=[]}={}){
  if(!uuid(proposalId)||typeof commitSha!=='string'||!SHA.test(commitSha)||
     typeof diffSha256!=='string'||!DIGEST.test(diffSha256))
   throw Error('Invalid proposal identity or commit SHA');
  const binding=proposals.get(proposalId.toLowerCase());
  if(!binding||binding.commitSha!==commitSha.toLowerCase()||
     binding.diffSha256!==diffSha256.toLowerCase())
   throw Error('Proposal binding mismatch');
  const canonicalPaths=await validateAtlasCanonicalPaths({repositoryRoot,paths});
  if(canonicalPaths.length!==binding.paths.length||
     canonicalPaths.some((path,index)=>path!==binding.paths[index]))
   throw Error('Proposal path binding mismatch');
  const upstream=await resolveGitHubCommit({repository,commitSha});
  if(typeof upstream!=='string'||upstream.toLowerCase()!==commitSha.toLowerCase())
   throw Error('GitHub commit SHA mismatch');
  return binding;
 }

 function assertApprovalBinding({
  approvalId,proposalId,commitSha,diffSha256,branch,expectedBaseSha
 }={}){
  if(!uuid(approvalId)||!uuid(proposalId)||typeof commitSha!=='string'||!SHA.test(commitSha)||
     typeof diffSha256!=='string'||!DIGEST.test(diffSha256)||
     typeof branch!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(branch)||
     branch.includes('..')||branch.endsWith('.lock')||
     typeof expectedBaseSha!=='string'||!SHA.test(expectedBaseSha))
   throw Error('Invalid approval binding');
 }

 async function consumeApproval({
  approvalId,proposalId,commitSha,diffSha256,branch,expectedBaseSha,paths=[]
 }={}){
  assertApprovalBinding({approvalId,proposalId,commitSha,diffSha256,branch,expectedBaseSha});
  const proposal=await verifyProposal({proposalId,commitSha,diffSha256,paths});
  const approvalContext={
   approvalId:approvalId.toLowerCase(),proposalId:proposal.proposalId,
   repository,commitSha:proposal.commitSha,diffSha256:diffSha256.toLowerCase(),
   branch,expectedBaseSha:expectedBaseSha.toLowerCase()
  };
  if(await verifyApproval(approvalContext)!==true)
   throw Error('Approval verification failed');
  const approvalRoot=resolve(approvalDirectory);
  const directoryCheck=await assertNoSymlinkComponents(approvalRoot);
  if(!directoryCheck.exists)throw Error('Approval directory must be pre-created');
  const directoryInfo=await lstat(approvalRoot);
  if(!directoryInfo.isDirectory()||(directoryInfo.mode&0o077)!==0)
   throw Error('Approval directory must be private and canonical');
  const approvalKey=createHash('sha256').update(approvalContext.approvalId).digest('hex');
  const consumed=await consumeAtlasApprovalOnce({
   directory:approvalRoot,approvalId:approvalKey,metadata:approvalContext
  });
  return Object.freeze({...consumed,approvalContext});
 }

 async function publishApprovedChange(input={}){
  const {
   approvalId,proposalId,commitSha,diffSha256,branch,expectedBaseSha,paths=[]
  }=input;
  assertApprovalBinding({approvalId,proposalId,commitSha,diffSha256,branch,expectedBaseSha});
  await verifyProposal({proposalId,commitSha,diffSha256,paths});
  const current=await readBranchHead({repository,branch});
  if(typeof current!=='string'||current.toLowerCase()!==expectedBaseSha.toLowerCase())
   return Object.freeze({status:'branch_precondition_failed',published:false});
  const consumed=await consumeApproval(input);
  if(!consumed.consumed)return Object.freeze({status:'approval_already_used',published:false});
  const beforePublish=await readBranchHead({repository,branch});
  if(typeof beforePublish!=='string'||beforePublish.toLowerCase()!==expectedBaseSha.toLowerCase())
   return Object.freeze({status:'branch_precondition_failed',published:false});
  let publication;
  try{
   publication=await publishCommit({
    repository,branch,expectedBaseSha:expectedBaseSha.toLowerCase(),
    proposalId:proposalId.toLowerCase(),commitSha:commitSha.toLowerCase(),
    diffSha256:diffSha256.toLowerCase()
   });
   if(publication?.commitSha?.toLowerCase()!==commitSha.toLowerCase())
    throw Error('Published commit mismatch');
   return Object.freeze({
    status:'published',published:true,commitSha:publication.commitSha.toLowerCase(),
    proposalId:proposalId.toLowerCase()
   });
  }catch{
   let rolledBack=false;
   try{
    rolledBack=await rollbackBranch({
     repository,branch,expectedCurrentSha:publication?.commitSha??commitSha,
     restoreSha:expectedBaseSha.toLowerCase()
    })===true;
   }catch{}
   return Object.freeze({
    status:rolledBack?'rolled_back':'rollback_required',published:false,
    proposalId:proposalId.toLowerCase(),rollbackConfirmed:rolledBack
   });
  }
 }

 return Object.freeze({createProposal,verifyProposal,consumeApproval,publishApprovedChange});
}
