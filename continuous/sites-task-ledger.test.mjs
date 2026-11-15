import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSitesTaskLedger} from './sites-task-ledger.mjs';

test('requires an approval phase before running',()=>{
 const ledger=createSitesTaskLedger();
 ledger.create({id:'t1',owner:'user1',goal:'Improve UI'});
 assert.throws(()=>ledger.transition({id:'t1',owner:'user1',to:'running'}));
 ledger.transition({id:'t1',owner:'user1',to:'awaiting_approval'});
 ledger.transition({id:'t1',owner:'user1',to:'approved'});
 ledger.transition({id:'t1',owner:'user1',to:'running'});
 const done=ledger.transition({id:'t1',owner:'user1',to:'completed'});
 assert.deepEqual(done.history.map(x=>x.status),['proposed','awaiting_approval','approved','running','completed']);
});
test('owner isolation prevents reading and editing other users tasks',()=>{
 const ledger=createSitesTaskLedger();
 ledger.create({id:'t1',owner:'user1',goal:'Private'});
 assert.equal(ledger.get({id:'t1',owner:'user2'}),null);
 assert.deepEqual(ledger.list({owner:'user2'}),[]);
 assert.throws(()=>ledger.transition({id:'t1',owner:'user2',to:'cancelled'}));
});
test('returned task snapshots cannot mutate internal state',()=>{
 const ledger=createSitesTaskLedger();
 const task=ledger.create({id:'t1',owner:'user1',goal:'Private'});
 task.history[0].status='fake';
 task.status='completed';
 assert.equal(ledger.get({id:'t1',owner:'user1'}).status,'proposed');
});
test('rejects duplicates and enforces capacity',()=>{
 const ledger=createSitesTaskLedger({maxTasks:1});
 ledger.create({id:'t1',owner:'a',goal:'x'});
 assert.throws(()=>ledger.create({id:'t1',owner:'a',goal:'x'}));
 assert.throws(()=>ledger.create({id:'t2',owner:'a',goal:'x'}));
});
