import {validateSitesLedgerSnapshot} from './sites-ledger-snapshot.mjs';

/**
 * Compare-and-swap snapshot store adapter for Sites.
 * Storage must be authenticated, durable and atomic; this module supplies
 * revision checks only and is not a database or security boundary.
 */
export function createVersionedSitesLedgerStore(adapter){
 if(!adapter||typeof adapter.read!=='function'||typeof adapter.compareAndSwap!=='function')
   throw Error('Atomic storage adapter required');
 return Object.freeze({
  async load({owner}={}){
   if(typeof owner!=='string'||!owner.trim())throw Error('Verified owner required');
   const record=await adapter.read(owner);
   if(record===null)return {revision:0,snapshot:{version:1,tasks:[]}};
   if(!record||!Number.isSafeInteger(record.revision)||record.revision<1)
     throw Error('Invalid stored revision');
   return {revision:record.revision,
    snapshot:validateSitesLedgerSnapshot(record.snapshot,{owner})};
  },
  async save({owner,expectedRevision,snapshot}={}){
   if(typeof owner!=='string'||!owner.trim()||
      !Number.isSafeInteger(expectedRevision)||expectedRevision<0)
     throw Error('Invalid owner or expected revision');
   const safe=validateSitesLedgerSnapshot(snapshot,{owner});
   const nextRevision=expectedRevision+1;
   if(!Number.isSafeInteger(nextRevision))throw Error('Revision overflow');
   const changed=await adapter.compareAndSwap(owner,expectedRevision,{
     revision:nextRevision,snapshot:safe
   });
   if(changed!==true)return {saved:false,conflict:true};
   return {saved:true,conflict:false,revision:nextRevision};
  },
 });
}

/** In-memory reference adapter for tests and demos, not production storage. */
export function createMemoryCasAdapter(){
 const records=new Map();
 return {
  async read(owner){
   const record=records.get(owner);
   return record?structuredClone(record):null;
  },
  async compareAndSwap(owner,expectedRevision,next){
   const current=records.get(owner);
   if((current?.revision??0)!==expectedRevision)return false;
   records.set(owner,structuredClone(next));
   return true;
  },
 };
}
