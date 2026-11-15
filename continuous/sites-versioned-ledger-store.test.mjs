import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSitesTaskLedger} from './sites-task-ledger.mjs';
import {exportSitesLedgerSnapshot} from './sites-ledger-snapshot.mjs';
import {createVersionedSitesLedgerStore,createMemoryCasAdapter} from './sites-versioned-ledger-store.mjs';

test('rejects stale writes instead of silently losing updates',async()=>{
 const store=createVersionedSitesLedgerStore(createMemoryCasAdapter());
 const ledger=createSitesTaskLedger();
 ledger.create({id:'one',owner:'alice',goal:'Review Atlas'});
 const first=await store.load({owner:'alice'});
 assert.equal(first.revision,0);
 const snapshot=exportSitesLedgerSnapshot(ledger,{owner:'alice'});
 assert.deepEqual(await store.save({owner:'alice',expectedRevision:0,snapshot}),
   {saved:true,conflict:false,revision:1});
 assert.deepEqual(await store.save({owner:'alice',expectedRevision:0,snapshot}),
   {saved:false,conflict:true});
 assert.equal((await store.load({owner:'alice'})).revision,1);
});
test('keeps owner data separated',async()=>{
 const store=createVersionedSitesLedgerStore(createMemoryCasAdapter());
 const ledger=createSitesTaskLedger();
 ledger.create({id:'private',owner:'alice',goal:'Secret'});
 await store.save({owner:'alice',expectedRevision:0,snapshot:exportSitesLedgerSnapshot(ledger,{owner:'alice'})});
 assert.deepEqual((await store.load({owner:'bob'})).snapshot.tasks,[]);
});
test('rejects mismatched owner snapshots before storage',async()=>{
 const store=createVersionedSitesLedgerStore(createMemoryCasAdapter());
 const ledger=createSitesTaskLedger();
 ledger.create({id:'private',owner:'alice',goal:'Secret'});
 await assert.rejects(store.save({owner:'bob',expectedRevision:0,
   snapshot:exportSitesLedgerSnapshot(ledger,{owner:'alice'})}));
});
test('requires a compare-and-swap storage adapter',()=>{
 assert.throws(()=>createVersionedSitesLedgerStore({read:async()=>null}));
});
