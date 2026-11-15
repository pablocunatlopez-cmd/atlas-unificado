import {open,mkdir,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
/**
 * Cooperative local one-time approval marker. Exclusive 'wx' creation is
 * atomic on a supported local filesystem; no cleanup or automatic expiry.
 * A failed write leaves a marker and fails closed.
 * Requires a trusted private directory; not a multi-host security primitive.
 */
export async function consumeAtlasApprovalOnce({
 directory,approvalId,metadata={}
}={}){
 if(typeof directory!=='string'||!directory.trim()||
  typeof approvalId!=='string'||!/^[a-f0-9]{64}$/.test(approvalId)||
  !metadata||typeof metadata!=='object'||Array.isArray(metadata))
  throw Error('Invalid approval consumption request');
 const encoded=JSON.stringify(metadata);
 if(typeof encoded!=='string'||encoded.length>4096)
  throw Error('Approval metadata too large or invalid');
 const root=resolve(directory);
 await mkdir(root,{recursive:true,mode:0o700});
 const info=await lstat(root);
 if(!info.isDirectory()||(info.mode&0o077)!==0)
  throw Error('Approval directory must be private (0700) and not a symlink');
 const marker=resolve(root,approvalId+'.used');
 let handle;
 try{
  handle=await open(marker,'wx',0o600);
 }catch(error){
  if(error?.code==='EEXIST')
   return Object.freeze({status:'already_consumed',consumed:false,
    approvalId,executesRestore:false});
  throw error;
 }
 try{
  await handle.writeFile(JSON.stringify({
   version:1,approvalId,metadata:JSON.parse(encoded)
  })+'\n','utf8');
  await handle.sync();
 }finally{
  await handle.close();
 }
 // Sync directory entry as well as marker contents where supported.
 // On platforms without directory fsync, fail closed; marker remains used.
 const dirHandle=await open(root,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_DIRECTORY);
 try{
  const opened=await dirHandle.stat();
  if(!opened.isDirectory()||opened.dev!==info.dev||opened.ino!==info.ino)
   throw Error('Approval directory changed during write');
  await dirHandle.sync();
 }finally{
  await dirHandle.close();
 }
 return Object.freeze({status:'consumed',consumed:true,approvalId,
  markerPath:marker,executesRestore:false,
  note:'Local filesystem fsync requested; host must still ensure trusted storage and backups'});
}
