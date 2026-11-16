/** Compact factual execution audit. Never expose chain-of-thought or infer unobserved hypotheses. */
export function sanitizeLiaExecutionAudit(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 if(value.reviewed!==true&&typeof value.reviewError!=='string'&&(!value.citationAudit||typeof value.citationAudit!=='object'))return null;
 const review=value.reviewed===true?'completed':typeof value.reviewError==='string'&&value.reviewError?'failed':'not-recorded';
 const citation=value.citationAudit&&typeof value.citationAudit==='object'?value.citationAudit:null;
 const unknown=Array.isArray(citation?.unknownLabels)?citation.unknownLabels.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,100)):[];
 return Object.freeze({
  schema:1,source:'local-chat-result',review,
  reviewAttempted:review!=='not-recorded',
  citationAuditRecorded:!!citation,
  unknownCitationLabels:unknown,
  sourcesReturned:Array.isArray(value.sources)?Math.min(value.sources.length,100):null,
  webRead:value.webRead===true,
  hypothesis:'not-recorded',
  revision:review==='completed'?'answer-revised-without-diff':'not-recorded',
  factualAccuracyVerified:false
 });
}
