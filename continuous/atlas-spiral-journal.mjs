import {createHash} from 'node:crypto';
import {spiralEvent,spiralTimeline} from './atlas-spiral-time.mjs';
/** Deterministic, private-memory-ready journal codec. Caller must supply authenticated storage. */
export function spiralJournalAppend(journal,event,{maxEvents=500}={}){
 if(!Array.isArray(journal)||!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>5000||journal.length>=maxEvents)throw new RangeError('Journal capacity exceeded');
 const timeline=spiralTimeline([...journal,event],{limit:maxEvents});
 const canonical=JSON.stringify(timeline.events.map(e=>({id:e.id,time:e.time,vertices:e.vertices,evidence:e.evidence,prediction:e.prediction,outcome:e.outcome,revisionOf:e.revisionOf,status:e.status})));
 return Object.freeze({events:timeline.events,tangents:timeline.tangents,sha256:createHash('sha256').update(canonical).digest('hex')});
}
/** Explicitly parse untrusted serialized events through the validated event constructor. */
export function spiralJournalImport(records,{maxEvents=500}={}){
 if(!Array.isArray(records)||records.length>maxEvents||records.length>5000)throw new RangeError('Invalid journal size');
 const events=records.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||!item.vertices||typeof item.vertices!=='object'||Array.isArray(item.vertices))throw new TypeError('Invalid event record');
  if(!['mental','physical','god'].every(k=>typeof item.vertices[k]==='string')||!Array.isArray(item.evidence)||typeof item.prediction!=='string'||typeof item.outcome!=='string'||(item.revisionOf!==null&&item.revisionOf!==undefined&&typeof item.revisionOf!=='string'))throw new TypeError('Incomplete or malformed event record');
  if(item.status!==undefined&&item.status!=='user-supplied-unverified')throw new TypeError('Untrusted event status');
  return spiralEvent({id:item.id,time:item.time,mental:item.vertices.mental,physical:item.vertices.physical,unknown:item.vertices.god,evidence:item.evidence,prediction:item.prediction,outcome:item.outcome,revisionOf:item.revisionOf});
 });
 return spiralTimeline(events,{limit:maxEvents});
}
