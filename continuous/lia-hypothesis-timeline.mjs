/** Read-only timeline of explicitly recorded hypotheses across completed jobs.
 * Repeated local IDs are namespaced by job. Changes are observations of
 * recorded status, not claims that the model learned or corrected itself.
 */
export function projectLiaHypothesisTimeline(events,{limit=100}={}){
 if(!Array.isArray(events)||!Number.isInteger(limit)||limit<1||limit>200)throw new TypeError('Invalid timeline');
 const timeline=[],lastByClaim=new Map();
 // Jobs can arrive newest-first from APIs; compare statuses only in chronological order.
 // Preserve input order for equal/missing timestamps to avoid fabricating chronology.
 const ordered=events.map((event,index)=>({event,index,time:typeof event?.updatedAt==='string'&&Number.isFinite(Date.parse(event.updatedAt))?Date.parse(event.updatedAt):null}))
  .sort((a,b)=>a.time!==null&&b.time!==null&&a.time!==b.time?a.time-b.time:a.index-b.index);
 for(const {event} of ordered){
  if(!event||event.status!=='completed'||typeof event.id!=='string'||!Array.isArray(event.hypotheses))continue;
  for(const hypothesis of event.hypotheses){
   if(!hypothesis||typeof hypothesis.id!=='string'||typeof hypothesis.claim!=='string'||typeof hypothesis.status!=='string')continue;
   const claim=hypothesis.claim.trim(),key=claim.toLowerCase();
   if(!claim||claim.length>600)continue;
   const previous=lastByClaim.get(key);
   const references=Array.isArray(hypothesis.evidence)?hypothesis.evidence.filter(e=>e&&typeof e.reference==='string'&&typeof e.type==='string').map(e=>e.type+':'+e.reference).slice(0,12):[];
   const previousEvidence=new Set(previous?.evidenceReferences||[]);
   const newEvidence=references.filter(reference=>!previousEvidence.has(reference));
   const item=Object.freeze({
    id:event.id+':'+hypothesis.id,jobId:event.id,hypothesisId:hypothesis.id,
    claim,status:hypothesis.status,origin:hypothesis.origin||'unknown',
    time:event.updatedAt||null,evidenceCount:references.length,evidenceReferences:Object.freeze(references),newEvidenceReferences:Object.freeze(newEvidence),
    recordedConclusion:typeof hypothesis.conclusion==='string'?hypothesis.conclusion.slice(0,600):'',
    priorRecordId:previous?.id||null,
    statusChanged:!!previous&&previous.status!==hypothesis.status,
    comparison:previous?(previous.status===hypothesis.status?'same-status':'status-changed'):'first-record',
    changeExplanation:previous&&previous.status!==hypothesis.status?(newEvidence.length?'Changed status with newly referenced evidence':'Changed status without newly referenced evidence'):'',
    factualAccuracyVerified:false
   });
   timeline.push(item);
   lastByClaim.set(key,item);
  }
 }
 return Object.freeze(timeline.slice(-limit));
}
