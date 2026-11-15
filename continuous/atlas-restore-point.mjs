import {createHash} from 'node:crypto';
/**
 * Immutable, content-addressed restoration proposal.
 * Does not read/write files, run commands, checkout Git or deploy.
 */
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createAtlasRestorePoint({
 revision,config,historyHeadHash=null,createdAt
}={}){
 if(typeof revision!=='string'||!/^[a-f0-9]{40}$/.test(revision)||
  !config||typeof config!=='object'||Array.isArray(config)||
  !Number.isSafeInteger(createdAt)||createdAt<0||
  historyHeadHash!==null&&
   (typeof historyHeadHash!=='string'||!/^[a-f0-9]{64}$/.test(historyHeadHash)))
  throw Error('Invalid restore point');
 const encoded=JSON.stringify(config);
 if(encoded.length>100_000)throw Error('Restore config too large');
 const copy=JSON.parse(encoded);
 if(!copy||typeof copy!=='object'||Array.isArray(copy))
  throw Error('Invalid restore config');
 const payload={revision,config:copy,historyHeadHash,createdAt};
 return Object.freeze({...payload,checksum:digest(payload)});
}
export function verifyAtlasRestorePoint(point){
 if(!point||typeof point!=='object')
  throw Error('Invalid restore point');
 const recreated=createAtlasRestorePoint(point);
 if(point.checksum!==recreated.checksum)
  throw Error('Restore point checksum mismatch');
 return Object.freeze({valid:true,revision:point.revision,
  checksum:point.checksum,revisionExists:'unverified',
  historyHeadAnchored:'unverified'});
}
export function planAtlasRestore({
 point,currentRevision,approved=false
}={}){
 verifyAtlasRestorePoint(point);
 if(typeof currentRevision!=='string'||!/^[a-f0-9]{40}$/.test(currentRevision))
  throw Error('Invalid current revision');
 return Object.freeze({
  status:approved?'ready_for_manual_execution':'approval_required',
  fromRevision:currentRevision,toRevision:point.revision,
  config:JSON.parse(JSON.stringify(point.config)),
  expectedHistoryHead:point.historyHeadHash,
  checksum:point.checksum,
  requiresGitRevisionVerification:true,
  executesRestore:false,
  warning:'Checksum is not a signature; verify Git revision and trusted history head before manual restore'
 });
}
