import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {simulateAtlasSandboxPatch} from './atlas-sandbox-patch-simulator.mjs';
/**
 * Materialize a disposable workspace of validated UTF-8 text files.
 * No commands are executed. This is not a security boundary for hostile code.
 * Call cleanup() after inspection. Caller must not expose this workspace to
 * untrusted programs without a separate OS-level sandbox.
 */
const SAFE=/^(?!\/)(?!.*\\)[a-zA-Z0-9_.\/-]{1,240}$/;
function safePath(root,relative){
 if(typeof relative!=='string'||!SAFE.test(relative)||
  relative.split('/').some(part=>!part||part==='.'||part==='..')||
  relative==='.git'||relative.startsWith('.git/')||
  relative==='node_modules'||relative.startsWith('node_modules/'))
  throw Error('Unsafe workspace path');
 const full=resolve(root,relative);
 if(!full.startsWith(root+sep))throw Error('Workspace escape');
 return full;
}
export async function materializeAtlasPatchWorkspace({
 proposal,currentRevision,snapshot
}={}){
 const simulated=simulateAtlasSandboxPatch({proposal,currentRevision,snapshot});
 const files=Object.entries(simulated.snapshot);
 if(files.length>500||files.reduce((sum,[,value])=>
  sum+Buffer.byteLength(value,'utf8'),0)>2_000_000)
  throw Error('Workspace snapshot limit exceeded');
 const root=await mkdtemp(join(tmpdir(),'atlas-patch-'));
 let cleaned=false;
 const cleanup=async()=>{
  if(cleaned)return;
  cleaned=true;
  await rm(root,{recursive:true,force:true});
 };
 try{
  for(const [path,value] of files){
   const target=safePath(root,path);
   await mkdir(resolve(target,'..'),{recursive:true});
   await writeFile(target,value,{encoding:'utf8',flag:'wx',mode:0o600});
  }
 }catch(error){await cleanup();throw error;}
 return Object.freeze({root,changes:simulated.changes,cleanup,
  status:'materialized_for_inspection',commandsExecuted:false,
  testsExecuted:false,osSandboxed:false,requiresHumanReview:true});
}
