import {createHash} from 'node:crypto';
import {evaluateLiaHypothesisTransition} from './lia-hypothesis-transition.mjs';
/** Append-only audit trail for explicit check outcomes; hash links detect accidental
 * modifications in a retained ledger, but are not signatures or external proof.
 */
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function appendLiaTransitionJournal(entries,input){
 if(!Array.isArray(entries)||entries.length>500)throw new TypeError('Invalid journal length');
 const previous=entries.at(-1)||null;
 if(previous&&!verifyLiaTransitionJournal(entries))throw new TypeError('Broken journal chain');
 if(!input||typeof input.id!=='string'||!/^[\w-]{1,80}$/.test(input.id)||entries.some(x=>x.id===input.id))throw new TypeError('Invalid or duplicate event ID');
 const transition=evaluateLiaHypothesisTransition({previousStatus:input.previousStatus,check:input.check});
 const timestamp=typeof input.timestamp==='string'&&/^\d{4}-\d\d-\d\dT/.test(input.timestamp)?input.timestamp:null;
 if(!timestamp||typeof input.hypothesisId!=='string'||!/^[\w-]{1,80}$/.test(input.hypothesisId))throw new TypeError('Explicit timestamp and hypothesis required');
 const payload=Object.freeze({id:input.id,hypothesisId:input.hypothesisId,timestamp,transition,previousHash:previous?.hash||null});
 const record=Object.freeze({...payload,hash:digest(payload)});
 return Object.freeze([...entries,record]);
}
export function verifyLiaTransitionJournal(entries){
 if(!Array.isArray(entries)||entries.length>501)return false;
 let prior=null;
 for(const entry of entries){
  if(!entry||entry.previousHash!==prior)return false;
  const {hash,...payload}=entry;
  if(typeof hash!=='string'||hash!==digest(payload))return false;
  prior=hash;
 }
 return true;
}
