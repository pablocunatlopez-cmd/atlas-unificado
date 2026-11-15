import {createHash} from 'node:crypto';
import {verifyAtlasSandboxPatch} from './atlas-sandbox-patch-preflight.mjs';
/**
 * Execute a proposal against a disposable IN-MEMORY snapshot only.
 * This is NOT an OS sandbox: no untrusted code runs and no disk is touched.
 * Caller must supply a complete trusted snapshot of the affected files.
 */
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
export function simulateAtlasSandboxPatch({
 proposal,currentRevision,snapshot
}={}){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
  Object.getPrototypeOf(snapshot)!==Object.prototype)
  throw Error('Invalid sandbox snapshot');
 const original=new Map();
 for(const [path,value] of Object.entries(snapshot)){
  if(typeof value!=='string'||path==='__proto__'||path==='constructor'||
   path==='prototype'||path.length>240)
   throw Error('Invalid snapshot file');
  original.set(path,value);
 }
 const preflight=verifyAtlasSandboxPatch({proposal,currentRevision,
  readCurrentFile:path=>original.has(path)?original.get(path):null});
 const staged=new Map(original);
 for(const op of proposal.operations){
  if(op.operation==='delete')staged.delete(op.path);
  else staged.set(op.path,op.content);
 }
 const changes=proposal.operations.map(op=>Object.freeze({
  path:op.path,operation:op.operation,
  beforeHash:original.has(op.path)?hash(original.get(op.path)):null,
  afterHash:staged.has(op.path)?hash(staged.get(op.path)):null
 }));
 return Object.freeze({
  status:'simulated_in_memory',preflight,changes,
  snapshot:Object.freeze(Object.fromEntries(staged)),
  diskWritten:false,commandsExecuted:false,testsExecuted:false,
  readyToMerge:false,requiresHumanReview:true
 });
}
