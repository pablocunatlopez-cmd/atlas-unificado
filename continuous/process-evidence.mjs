const ID=/^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const SHA256=/^[a-f0-9]{64}$/i;
const outcomes=new Set(['passed','failed']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=160)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const digest=value=>typeof value==='string'&&SHA256.test(value);
const isoTime=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));

/**
 * Check only whether an untrusted evidence report has the expected bounded shape.
 * This function deliberately does not authenticate the producer and never labels
 * a report verified or integrated. Those claims require a trusted verifier.
 */
export function inspectEvidenceResult(value,{now=Date.now(),maxAgeMs=30*24*60*60*1000}={}){
 if(value===null||value===undefined)return {status:'absent',claim:'none'};
 if(!object(value)||value.version!==1||!ID.test(value.taskId||'')||!ID.test(value.processId||'')||!ID.test(value.artifactId||'')||!digest(value.artifactRevision)||!isoTime(value.completedAt))return {status:'invalid',claim:'untrusted'};
 const completed=Date.parse(value.completedAt),age=now-completed;
 if(!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<0||age<0)return {status:'invalid',claim:'untrusted'};
 if(age>maxAgeMs)return {status:'stale',claim:'untrusted'};
 if(!Array.isArray(value.tests)||value.tests.length<1||value.tests.length>32||!value.tests.every(test=>object(test)&&ID.test(test.id||'')&&text(test.version,64)&&outcomes.has(test.outcome)))return {status:'incomplete',claim:'untrusted'};
 const comparison=value.comparison;
 if(!object(comparison)||!digest(comparison.baselineRevision)||!digest(comparison.candidateRevision)||comparison.candidateRevision.toLowerCase()!==value.artifactRevision.toLowerCase()||!['improved','unchanged','regressed','incomparable'].includes(comparison.outcome)||!text(comparison.reason,240))return {status:'incomplete',claim:'untrusted'};
 if(!object(value.decision)||!['accepted','rejected','deferred'].includes(value.decision.outcome)||!text(value.decision.reason,240))return {status:'incomplete',claim:'untrusted'};
 if(value.integration!==undefined&&(!object(value.integration)||!digest(value.integration.revision)||!isoTime(value.integration.at)))return {status:'invalid',claim:'untrusted'};
 if(value.integration&&value.decision.outcome!=='accepted')return {status:'invalid',claim:'untrusted'};
 // A structurally complete report is merely ready for independent review.
 return {status:'ready_for_review',claim:'reported',taskId:value.taskId,processId:value.processId,artifactId:value.artifactId,completedAt:new Date(completed).toISOString(),testCount:value.tests.length,decision:value.decision.outcome,hasIntegration:!!value.integration};
}
