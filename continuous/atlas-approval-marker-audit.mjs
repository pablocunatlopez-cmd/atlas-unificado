import {readdir,lstat,readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
/**
 * Read-only, bounded audit of one-time approval markers. Invalid or partial
 * markers are never deleted and must remain blocked pending human review.
 * This is a local diagnostic, not filesystem integrity attestation.
 */
export async function auditAtlasApprovalMarkers({directory,maxMarkers=10000}={}){
 if(typeof directory!=='string'||!directory.trim()||
  !Number.isSafeInteger(maxMarkers)||maxMarkers<1||maxMarkers>10000)
  throw Error('Invalid marker audit configuration');
 const root=resolve(directory);
 const info=await lstat(root);
 if(!info.isDirectory()||(info.mode&0o077)!==0)
  throw Error('Marker directory must be private and not a symlink');
 const names=await readdir(root);
 if(names.length>maxMarkers)throw Error('Marker audit limit exceeded');
 const findings=[];
 for(const name of names.sort()){
  if(!/^[a-f0-9]{64}\.used$/.test(name)){
   findings.push({name,status:'unexpected_entry'});
   continue;
  }
  const path=join(root,name);
  const item=await lstat(path);
  if(!item.isFile()||item.size>8192||(item.mode&0o077)!==0){
   findings.push({name,status:'unsafe_marker'});
   continue;
  }
  let valid=false;
  try{
   const raw=await readFile(path,'utf8');
   const data=JSON.parse(raw);
   valid=data?.version===1&&data.approvalId===name.slice(0,64)&&
    data.metadata!==null&&typeof data.metadata==='object'&&
    !Array.isArray(data.metadata);
  }catch{}
  findings.push({name,status:valid?'valid_marker':'invalid_or_partial_marker'});
 }
 return Object.freeze({
  status:findings.every(f=>f.status==='valid_marker')?'audit_clean':'requires_human_review',
  checked:findings.length,findings,
  removedMarkers:0,executesRestore:false,
  note:'Never delete or repair partial markers automatically'
 });
}
