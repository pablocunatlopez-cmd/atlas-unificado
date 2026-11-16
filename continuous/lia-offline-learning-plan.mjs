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
 const sorted=[...eligible].sort((a,b)=>hash(a.contentHash).localeCompare(hash(b.contentHash)));
 const holdoutCount=Math.max(1,Math.ceil(sorted.length*holdoutFraction));
 const holdout=sorted.slice(0,holdoutCount),training=sorted.slice(holdoutCount);
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
