import {createHash,timingSafeEqual} from 'node:crypto';
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const STATUS=new Set(['intent_recorded','review_blocked','outcome_unknown','manual_review_required','host_reported_committed']);
const SOURCE=new Set(['host','planner','recovery']);
function hash(value){return createHash('sha256').update(value,'utf8').digest('hex');}
function canonical({transactionId,index,atMs,status,source,previousHash}){
 return JSON.stringify([1,transactionId,index,atMs,status,source,previousHash]);
}
/**
 * Deterministic hash chain for detecting accidental or unauthorized modifications.
 * A hash chain alone is NOT an authenticated, tamper-proof audit log: an attacker
 * able to rewrite the entire log can recompute every hash. Pin the final hash in
 * a separately controlled, trusted system to detect such rewriting.
 */
export function buildAtlasAuditHashChain({transactionId,observations=[]}={}){
 if(!ID.test(transactionId||'')||!Array.isArray(observations)||observations.length>500)
  throw Error('Invalid audit hash chain');
 let previousHash='0'.repeat(64);
 const entries=observations.map((event,index)=>{
  if(!event||!Number.isSafeInteger(event.atMs)||event.atMs<0||
     !STATUS.has(event.status)||!SOURCE.has(event.source))
   throw Error('Invalid audit chain event');
  const entry={transactionId,index,atMs:event.atMs,status:event.status,
   source:event.source,previousHash};
  const entryHash=hash(canonical(entry));
  previousHash=entryHash;
  return Object.freeze({...entry,entryHash});
 });
 return Object.freeze({schemaVersion:1,transactionId,entries:Object.freeze(entries),
  finalHash:previousHash,integrity:'unanchored_hash_chain',
  authorizationGranted:false});
}
export function verifyAtlasAuditHashChain(chain,{trustedFinalHash}={}){
 if(!chain||chain.schemaVersion!==1||!ID.test(chain.transactionId||'')||
    !Array.isArray(chain.entries)||chain.entries.length>500||!HEX.test(chain.finalHash||''))
  return Object.freeze({valid:false,anchored:false,authorizationGranted:false});
 let previousHash='0'.repeat(64);
 for(let index=0;index<chain.entries.length;index++){
  const entry=chain.entries[index];
  if(!entry||entry.transactionId!==chain.transactionId||entry.index!==index||
     !Number.isSafeInteger(entry.atMs)||entry.atMs<0||
     !STATUS.has(entry.status)||!SOURCE.has(entry.source)||
     entry.previousHash!==previousHash||!HEX.test(entry.entryHash||''))
   return Object.freeze({valid:false,anchored:false,authorizationGranted:false});
  const computed=hash(canonical(entry));
  if(!timingSafeEqual(Buffer.from(computed,'hex'),Buffer.from(entry.entryHash,'hex')))
   return Object.freeze({valid:false,anchored:false,authorizationGranted:false});
  previousHash=computed;
 }
 const valid=previousHash===chain.finalHash;
 const anchored=valid&&HEX.test(trustedFinalHash||'')&&
  timingSafeEqual(Buffer.from(previousHash,'hex'),Buffer.from(trustedFinalHash,'hex'));
 return Object.freeze({valid,anchored,authorizationGranted:false,
  integrity:anchored?'externally_anchored_hash_match':'unanchored_hash_chain'});
}
