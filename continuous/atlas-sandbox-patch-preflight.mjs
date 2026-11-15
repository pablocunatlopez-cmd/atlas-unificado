import {createHash} from 'node:crypto';
import {planAtlasPatch} from './atlas-patch-planner.mjs';
/**
 * Content-bound coding proposal for a trusted, isolated executor.
 * Never writes to the repository. Content is kept in memory only.
 */
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
export function prepareAtlasSandboxPatch({
 proposalId,baseRevision,files,expectedCurrent={}
}={}){
 if(typeof baseRevision!=='string'||!/^[a-f0-9]{40}$/.test(baseRevision)||
  !expectedCurrent||typeof expectedCurrent!=='object'||
  Array.isArray(expectedCurrent))throw Error('Invalid sandbox base revision');
 const patch=planAtlasPatch({proposalId,files});
 const operations=files.map(file=>{
  const expected=expectedCurrent[file.path];
  if(file.operation==='create'){
   if(expected!==undefined&&expected!==null)
    throw Error('Create target must not exist');
  }else if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected)){
   throw Error('Existing file hash required');
  }
  return Object.freeze({operation:file.operation,path:file.path,
   expectedHash:file.operation==='create'?null:expected,
   proposedHash:file.operation==='delete'?null:sha(file.content),
   content:file.operation==='delete'?null:file.content});
 });
 const manifest={proposalId,baseRevision,operations:operations.map(
  ({operation,path,expectedHash,proposedHash})=>({
   operation,path,expectedHash,proposedHash
  }))};
 return Object.freeze({
  ...manifest,manifestHash:sha(JSON.stringify(manifest)),
  patch,requiresSandbox:true,requiresHumanReview:true,
  executed:false,operations:Object.freeze(operations)
 });
}
export function verifyAtlasSandboxPatch({proposal,currentRevision,readCurrentFile}={}){
 if(!proposal||typeof readCurrentFile!=='function'||
  currentRevision!==proposal.baseRevision)
  throw Error('Sandbox base revision mismatch');
 const manifest={proposalId:proposal.proposalId,
  baseRevision:proposal.baseRevision,
  operations:proposal.operations.map(
   ({operation,path,expectedHash,proposedHash})=>({
    operation,path,expectedHash,proposedHash
   }))};
 if(sha(JSON.stringify(manifest))!==proposal.manifestHash)
  throw Error('Sandbox manifest changed');
 const checks=proposal.operations.map(op=>{
  const current=readCurrentFile(op.path);
  if(current!==null&&typeof current!=='string')
   throw Error('Invalid current file content');
  const actual=current===null?null:sha(current);
  if(actual!==op.expectedHash)
   throw Error('Sandbox file drift: '+op.path);
  if(op.operation!=='delete'&&sha(op.content)!==op.proposedHash)
   throw Error('Sandbox proposed content changed');
  return Object.freeze({path:op.path,preconditionVerified:true});
 });
 return Object.freeze({status:'ready_for_isolated_execution',
  checks,executed:false,requiresHumanReview:true});
}
