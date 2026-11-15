import {readFile,writeFile,rename,open,mkdir} from 'node:fs/promises';
import {dirname,resolve,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
/**
 * Explicit local JSON persistence. No automatic recovery or model promotion.
 * Caller chooses a trusted directory; no symlink-hardening guarantee.
 */
export async function readAtlasEvaluationHistoryFile({filePath}={}){
 if(typeof filePath!=='string'||!filePath.trim())
  throw Error('History path required');
 let content;
 try{content=await readFile(resolve(filePath),'utf8');}
 catch(error){
  if(error?.code==='ENOENT')return Object.freeze({entries:[],exists:false});
  throw error;
 }
 if(content.length>2_000_000)throw Error('History file too large');
 const entries=JSON.parse(content);
 verifyAtlasEvaluationHistory(entries);
 return Object.freeze({entries,exists:true});
}
export async function writeAtlasEvaluationHistoryFile({
 filePath,entries,expectedHeadHash
}={}){
 if(typeof filePath!=='string'||!filePath.trim()||
  typeof expectedHeadHash!=='string'&&expectedHeadHash!==null)
  throw Error('History path and expected head required');
 verifyAtlasEvaluationHistory(entries);
 const destination=resolve(filePath);
 const current=await readAtlasEvaluationHistoryFile({filePath:destination});
 const currentHead=current.entries.at(-1)?.hash??null;
 if(currentHead!==expectedHeadHash)
  throw Error('History changed since last read');
 const directory=dirname(destination);
 await mkdir(directory,{recursive:true});
 const temporary=resolve(directory,'.'+basename(destination)+'.'+randomUUID()+'.tmp');
 const payload=JSON.stringify(entries,null,2)+'\n';
 if(payload.length>2_000_000)throw Error('History payload too large');
 let handle;
 try{
  handle=await open(temporary,'wx',0o600);
  await handle.writeFile(payload,'utf8');
  await handle.sync();
  await handle.close();handle=null;
  await rename(temporary,destination);
 }finally{
  if(handle)await handle.close();
  const {unlink}=await import('node:fs/promises');
  await unlink(temporary).catch(error=>{if(error?.code!=='ENOENT')throw error;});
 }
 return Object.freeze({path:destination,headHash:entries.at(-1)?.hash??null,
  count:entries.length});
}
