import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSitesTaskLedger} from './sites-task-ledger.mjs';
import {exportSitesLedgerSnapshot,restoreSitesLedgerSnapshot,validateSitesLedgerSnapshot} from './sites-ledger-snapshot.mjs';

test('exports and restores approved task with validated history',()=>{
 const ledger=createSitesTaskLedger();
 ledger.create({id:'a',owner:'alice',goal:'Improve Atlas'});
 ledger.transition({id:'a',owner:'alice',to:'awaiting_approval'});
 ledger.transition({id:'a',owner:'alice',to:'approved'});
 const snapshot=exportSitesLedgerSnapshot(ledger,{owner:'alice'});
 const restored=restoreSitesLedgerSnapshot(snapshot,{owner:'alice'});
 assert.deepEqual(restored.get({id:'a',owner:'alice'}),ledger.get({id:'a',owner:'alice'}));
});
test('refuses cross-owner import',()=>{
 const ledger=createSitesTaskLedger();
 ledger.create({id:'a',owner:'alice',goal:'Private'});
 const snapshot=exportSitesLedgerSnapshot(ledger,{owner:'alice'});
 assert.throws(()=>restoreSitesLedgerSnapshot(snapshot,{owner:'bob'}));
});
test('rejects forged approval transitions',()=>{
 const snapshot={version:1,tasks:[{id:'a',owner:'alice',goal:'x',status:'approved',
 history:[{status:'proposed'},{status:'approved'}]}]};
 assert.throws(()=>validateSitesLedgerSnapshot(snapshot,{owner:'alice'}));
});
test('rejects contradictory task status and duplicate IDs',()=>{
 const task={id:'a',owner:'alice',goal:'x',status:'completed',history:[{status:'proposed'}]};
 assert.throws(()=>validateSitesLedgerSnapshot({version:1,tasks:[task]},{owner:'alice'}));
 assert.throws(()=>validateSitesLedgerSnapshot({version:1,tasks:[{...task,status:'proposed'}, {...task,status:'proposed'}]},{owner:'alice'}));
});
