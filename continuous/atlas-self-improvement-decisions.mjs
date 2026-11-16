import {createHash} from 'node:crypto';
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const STATUSES=new Set(['proposed','rejected','needs_evidence','approved_for_review']);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
/**
 * Pure, append-only decision ledger with explicit evidence provenance.
 * Caller stores snapshots; this module does not read or write files.
 * Approval for review is NOT permission to execute or merge.
 */
export function appendAtlasDecision({history=[],entry}={}){
 if(!Array.isArray(history)||history.length>500||!entry||
    !ID.test(entry.proposalId||'')||!STATUSES.has(entry.status)||
    typeof entry.reason!=='string'||!entry.reason.trim()||
    entry.reason.length>2000||
    typeof entry.evidenceDigest!=='string'||
    !/^[a-f0-9]{64}$/.test(entry.evidenceDigest)||
    !Number.isSafeInteger(entry.sequence)||entry.sequence!==history.length+1)
  throw Error('Invalid decision entry');
 let previous='0'.repeat(64);
 for(let i=0;i<history.length;i++){
  const item=history[i];
  if(!item||item.sequence!==i+1||item.previousDigest!==previous||
     typeof item.digest!=='string'||!(/^[a-f0-9]{64}$/.test(item.digest)))
   throw Error('Invalid decision history');
  const {digest:stored,...record}=item;
  if(digest(record)!==stored)throw Error('Tampered decision history');
  previous=stored;
 }
 const record={sequence:entry.sequence,proposalId:entry.proposalId,
  status:entry.status,reason:entry.reason,evidenceDigest:entry.evidenceDigest,
  previousDigest:previous};
 const item=Object.freeze({...record,digest:digest(record)});
 return Object.freeze([...history,item]);
}
export function compareAtlasDecisions(history,proposalId){
 if(!Array.isArray(history)||history.length>500||!ID.test(proposalId||''))
  throw Error('Invalid history query');
 // Re-validate integrity using the same deterministic digest chain.
 let previous='0'.repeat(64);
 for(let i=0;i<history.length;i++){
  const item=history[i];
  if(!item||item.sequence!==i+1||item.previousDigest!==previous)
   throw Error('Invalid decision chain');
  const {digest:stored,...record}=item;
  if(digest(record)!==stored)throw Error('Tampered decision history');
  previous=stored;
 }
 const matches=history.filter(item=>item.proposalId===proposalId);
 const changes=matches.slice(1).filter((item,index)=>
  item.status!==matches[index].status||
  item.evidenceDigest!==matches[index].evidenceDigest);
 return Object.freeze({proposalId,decisions:Object.freeze([...matches]),
  changes:Object.freeze(changes.map(item=>Object.freeze({
   sequence:item.sequence,status:item.status,reason:item.reason,
   evidenceDigest:item.evidenceDigest
  }))),status:matches.length?matches.at(-1).status:'unknown',
  note:'A changed decision is recorded, not independently justified'});
}
