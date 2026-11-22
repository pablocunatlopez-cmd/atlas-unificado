/** Audit offline learning candidates for leakage, consent and traceability.
 * This is a preflight audit, not model training or an independent fact check.
 */
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function auditLiaLearningDataset(consolidation,plan){
 if(!consolidation||consolidation.schema!=='lia-memory-consolidation-v1'||
  !Array.isArray(consolidation.retained)||!plan||plan.schema!=='lia-offline-learning-plan-v1'||
  !Array.isArray(plan.trainingHashes)||!Array.isArray(plan.holdoutHashes))
  throw new TypeError('Invalid learning audit input');
 const byHash=new Map(),issues=[];
 for(const e of consolidation.retained){
  if(!e||typeof e.contentHash!=='string'||typeof e.content!=='string'||
   typeof e.characterId!=='string')throw new TypeError('Invalid retained memory');
  if(byHash.has(e.contentHash))issues.push('duplicate-memory-hash');
  byHash.set(e.contentHash,e);
 }
 const training=new Set(plan.trainingHashes),holdout=new Set(plan.holdoutHashes);
 if(training.size!==plan.trainingHashes.length||holdout.size!==plan.holdoutHashes.length)
  issues.push('duplicate-partition-hash');
 for(const h of training)if(holdout.has(h))issues.push('same-memory-in-train-and-holdout');
 for(const h of [...training,...holdout])if(!byHash.has(h))issues.push('missing-memory-hash');
 const trainContent=new Set(),holdContent=new Set();
 const normalized=e=>sha(e.content.trim().toLowerCase().replace(/\s+/g,' '));
 for(const h of training){const e=byHash.get(h);if(e){trainContent.add(normalized(e));if(!e.evidenceVerified||e.kind==='hypothesis')issues.push('ineligible-training-memory')}}
 for(const h of holdout){const e=byHash.get(h);if(e){holdContent.add(normalized(e));if(!e.evidenceVerified||e.kind==='hypothesis')issues.push('ineligible-holdout-memory')}}
 for(const h of trainContent)if(holdContent.has(h))issues.push('content-leakage-across-characters');
 const auditedCount=training.size+holdout.size;
 if(auditedCount!==plan.eligibleCount)issues.push('partition-count-mismatch');
 const uniqueIssues=[...new Set(issues)].sort();
 return Object.freeze({schema:'lia-learning-audit-v1',passed:uniqueIssues.length===0,
  issues:Object.freeze(uniqueIssues),auditedCount,
  contentLeakageDetected:uniqueIssues.includes('content-leakage-across-characters'),
  trainingExecuted:false,externalVerificationPerformed:false,
  promotionAuthorized:false});
}
