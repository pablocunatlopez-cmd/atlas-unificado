import {open,readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
/**
 * Cooperative local one-time approval marker. Exclusive 'wx' creation is
 * atomic on a supported local filesystem; no cleanup or automatic expiry.
 * The directory must be trusted, private and not writable by other users.
 * Does not prevent replay across hosts or independent storage directories.
 */
export async function consumeAtlasApprovalOnce({
 directory,approvalId,metadata={}
}={}){
 if(typeof directory!=='string'||!directory.trim()||
  typeof approvalId!=='string'||!/^[a-f0-9]{64}$/.test(approvalId)||
  !metadata||typeof metadata!=='object'||Array.isArray(metadata))
  throw Error('Invalid approval consumption request');
 const encoded=JSON.stringify(metadata);
 if(encoded.length>4096)throw Error('Approval metadata too large');
 const root=resolve(directory);
 await mkdir(root,{recursive:true,mode:0o700});
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
 return Object.freeze({status:'consumed',consumed:true,approvalId,
  markerPath:marker,executesRestore:false,
  note:'Host must control directory access and persist markers across restarts'});
}
