/** Explicit audit transitions only. The rules assess recorded checks, not real-world truth. */
const STATUSES=new Set(['proposed','testing','supported','refuted','inconclusive']);
const OUTCOMES=new Set(['pass','fail','unknown']);
export function evaluateLiaHypothesisTransition({previousStatus,check}={}){
 if(!STATUSES.has(previousStatus))throw new TypeError('Invalid previous status');
 if(!check||check.executed!==true||!OUTCOMES.has(check.outcome)||typeof check.reference!=='string'||!check.reference.trim()||check.reference.length>240||!['citation-audit','deterministic-tool','model-review'].includes(check.kind))throw new TypeError('Recorded executed check required');
 let nextStatus='inconclusive',rule='executed-check-inconclusive';
 if(check.kind==='model-review'){
  nextStatus='inconclusive';rule='model-review-does-not-prove-claim';
 }else if(check.outcome==='pass'){
  nextStatus='supported';rule='recorded-check-passed';
 }else if(check.outcome==='fail'){
  nextStatus='refuted';rule='recorded-check-failed';
 }
 return Object.freeze({
  previousStatus,nextStatus,changed:previousStatus!==nextStatus,rule,
  check:Object.freeze({kind:check.kind,outcome:check.outcome,reference:check.reference.trim(),executed:true}),
  explanation:nextStatus==='supported'?'Recorded check passed; no independent factual verification':nextStatus==='refuted'?'Recorded check failed against its defined condition':'Recorded check is inconclusive or cannot establish truth',
  factualAccuracyVerified:false
 });
}
