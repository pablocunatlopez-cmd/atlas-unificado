import {createHash} from 'node:crypto';
/**
 * Append-only, hash-chained evaluation history in memory.
 * The trusted host persists the returned JSON; this module never writes files.
 */
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MAX_ENTRIES=1000;
function validateRecord(record){
 if(!record||typeof record!=='object'||Array.isArray(record)||
  typeof record.baselineId!=='string'||!record.baselineId.trim()||
  record.baselineId.length>100||
  typeof record.candidateId!=='string'||!record.candidateId.trim()||
  record.candidateId.length>100||
  !['eligible_for_human_review','reject_candidate'].includes(record.recommendation)||
  !Number.isFinite(record.qualityDelta)||record.qualityDelta< -1||
  record.qualityDelta>1||
  !Number.isFinite(record.baselineLatencyMs)||record.baselineLatencyMs<0||
  !Number.isFinite(record.candidateLatencyMs)||record.candidateLatencyMs<0||
  !Array.isArray(record.newFailures)||record.newFailures.length>100||
  record.newFailures.some(x=>typeof x!=='string'||x.length>64)||
  typeof record.latencyWithinLimit!=='boolean')
  throw Error('Invalid A/B history record');
 return {
  baselineId:record.baselineId,candidateId:record.candidateId,
  recommendation:record.recommendation,qualityDelta:record.qualityDelta,
  baselineLatencyMs:record.baselineLatencyMs,
  candidateLatencyMs:record.candidateLatencyMs,
  newFailures:[...record.newFailures],
  latencyWithinLimit:record.latencyWithinLimit
 };
}
export function appendAtlasEvaluationHistory({entries=[],record,timestamp}={}){
 if(!Array.isArray(entries)||entries.length>=MAX_ENTRIES||
  !Number.isSafeInteger(timestamp)||timestamp<0)
  throw Error('Invalid evaluation history');
 verifyAtlasEvaluationHistory(entries);
 const data=validateRecord(record);
 const previousHash=entries.length?entries.at(-1).hash:null;
 const payload={sequence:entries.length+1,timestamp,previousHash,data};
 const entry=Object.freeze({...payload,hash:hash(payload)});
 return Object.freeze([...entries,entry]);
}
export function verifyAtlasEvaluationHistory(entries){
 if(!Array.isArray(entries)||entries.length>MAX_ENTRIES)
  throw Error('Invalid evaluation history');
 let previousHash=null;
 for(let i=0;i<entries.length;i++){
  const entry=entries[i];
  if(!entry||entry.sequence!==i+1||
   !Number.isSafeInteger(entry.timestamp)||entry.timestamp<0||
   entry.previousHash!==previousHash)
   throw Error('Evaluation history chain invalid');
  const data=validateRecord(entry.data);
  const payload={sequence:entry.sequence,timestamp:entry.timestamp,
   previousHash,data};
  if(entry.hash!==hash(payload))throw Error('Evaluation history hash mismatch');
  previousHash=entry.hash;
 }
 return Object.freeze({valid:true,count:entries.length,headHash:previousHash,
  caveat:'Hash chaining detects edits only when an earlier trusted head is retained'});
}
