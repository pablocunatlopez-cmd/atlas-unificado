/** Prepare reviewable offline training candidates; never train or promote weights. */
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function planLiaOfflineLearning(consolidation,{baseModelId,minimumVerified=10,holdoutFraction=.2}={}){
 if(!consolidation||consolidation.schema!=='lia-memory-consolidation-v1'||!Array.isArray(consolidation.retained)||
  typeof baseModelId!=='string'||!/^[a-zA-Z0-9_.-]{1,128}$/.test(baseModelId)||
  !Number.isInteger(minimumVerified)||minimumVerified<2||minimumVerified>100000||
  typeof holdoutFraction!=='number'||holdoutFraction<.1||holdoutFraction>.5)
  throw new TypeError('Invalid offline learning plan');
 const eligible=consolidation.retained.filter(e=>e.evidenceVerified===true&&e.kind!=='hypothesis');
 // Keep identical normalized content in one partition, even across characters.
 const groups=new Map();
 for(const e of eligible){
  const key=hash(e.content.trim().toLowerCase().replace(/\s+/g,' '));
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(e);
 }
 const ordered=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 const holdoutGroupCount=Math.max(1,Math.ceil(ordered.length*holdoutFraction));
 const holdout=ordered.slice(0,holdoutGroupCount).flatMap(([,items])=>items);
 const training=ordered.slice(holdoutGroupCount).flatMap(([,items])=>items);
 const sorted=ordered.flatMap(([,items])=>items);
 const ready=eligible.length>=minimumVerified&&training.length>0&&holdout.length>0;
 return Object.freeze({schema:'lia-offline-learning-plan-v1',baseModelId,
  eligibleCount:eligible.length,trainingCount:training.length,holdoutCount:holdout.length,
  trainingHashes:Object.freeze(training.map(e=>e.contentHash)),
  holdoutHashes:Object.freeze(holdout.map(e=>e.contentHash)),
  datasetFingerprint:hash(sorted.map(e=>e.contentHash)),
  candidateReadyForReview:ready,trainingExecuted:false,adapterCreated:false,
  modelPromoted:false,networkAccess:false,holdoutIndependenceVerified:false,
  requiresHumanApproval:true});
}
