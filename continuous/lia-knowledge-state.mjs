/** Read-only epistemic projection. Memory is a record, never proof of truth. */
const STATUS=new Set(['proposed','testing','supported','refuted','inconclusive']);
export function projectLiaKnowledgeState(hypothesisTimeline,{limit=100}={}){
 if(!Array.isArray(hypothesisTimeline)||!Number.isInteger(limit)||limit<1||limit>200)throw new TypeError('Invalid knowledge projection');
 const latest=new Map();
 for(const record of hypothesisTimeline){
  if(!record||typeof record.claim!=='string'||!record.claim.trim()||typeof record.id!=='string'||!STATUS.has(record.status))continue;
  const key=record.claim.trim().toLocaleLowerCase('en');
  const evidence=Array.isArray(record.evidenceReferences)?record.evidenceReferences.filter(x=>typeof x==='string').slice(0,12):[];
  const verifiedExecution=evidence.some(x=>x.startsWith('tool-output:'))&&record.origin==='tool';
  const state=record.status==='supported'&&verifiedExecution?'check-supported':record.status==='refuted'&&verifiedExecution?'check-refuted':'unverified-hypothesis';
  latest.set(key,Object.freeze({
   claim:record.claim.trim(),recordId:record.id,jobId:record.jobId||null,
   state,recordedStatus:record.status,hasRecordedToolEvidence:verifiedExecution,
   evidenceReferences:Object.freeze(evidence),memoryRecorded:true,
   factualAccuracyVerified:false,
   explanation:state==='check-supported'?'A recorded tool check supported its defined condition, not independent truth':state==='check-refuted'?'A recorded tool check refuted its defined condition, not necessarily the whole claim':'Recorded memory or hypothesis without a qualifying tool check'
  }));
 }
 return Object.freeze([...latest.values()].slice(-limit));
}
