/** Explicit hypothesis ledger. Only records claims supplied as structured data.
 * No model reasoning trace is inferred or reconstructed from prose.
 */
const clean=(value,max=600)=>typeof value==='string'?value.trim().slice(0,max):'';
const ID=/^[a-zA-Z0-9_-]{1,80}$/;
export function validateLiaHypothesis(entry){
 if(!entry||typeof entry!=='object'||Array.isArray(entry)||!ID.test(entry.id)||!clean(entry.claim))throw new TypeError('Hypothesis requires explicit id and claim');
 if(!['proposed','testing','supported','refuted','inconclusive'].includes(entry.status))throw new TypeError('Invalid hypothesis status');
 if(!['user','tool','model'].includes(entry.origin))throw new TypeError('Unknown hypothesis origin');
 if(!Array.isArray(entry.evidence)||entry.evidence.length>12)throw new TypeError('Invalid evidence list');
 const evidence=entry.evidence.map(item=>{
  if(!item||!['user-report','tool-output','external-source'].includes(item.type)||!clean(item.reference,240))throw new TypeError('Invalid evidence reference');
  return Object.freeze({type:item.type,reference:clean(item.reference,240),verified:item.verified===true&&item.type==='tool-output'});
 });
 const revisionOf=entry.revisionOf==null?null:entry.revisionOf;
 if(revisionOf!==null&&!ID.test(revisionOf))throw new TypeError('Invalid revision reference');
 return Object.freeze({id:entry.id,claim:clean(entry.claim),status:entry.status,origin:entry.origin,evidence:Object.freeze(evidence),revisionOf,conclusion:clean(entry.conclusion),factualAccuracyVerified:false});
}
export function buildLiaHypothesisLedger(entries){
 if(!Array.isArray(entries)||entries.length>30)throw new TypeError('Too many hypotheses');
 const seen=new Set();
 return Object.freeze(entries.map(raw=>{
  const entry=validateLiaHypothesis(raw);
  if(seen.has(entry.id)||entry.revisionOf!==null&&!seen.has(entry.revisionOf))throw new TypeError('Duplicate or future revision');
  seen.add(entry.id);
  return entry;
 }));
}
