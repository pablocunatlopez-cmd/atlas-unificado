import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spiralEvent} from './atlas-spiral-time.mjs';
import {spiralJournalAppend,spiralJournalImport} from './atlas-spiral-journal.mjs';
test('journal is append-only, ordered, bounded and fingerprinted',()=>{
 const a=spiralEvent({id:'a',time:1,mental:'idea'});
 const b=spiralEvent({id:'b',time:2,physical:'observación'});
 const one=spiralJournalAppend([],a);
 const two=spiralJournalAppend(one.events,b);
 assert.equal(one.events.length,1);
 assert.equal(two.events.length,2);
 assert.equal(two.tangents[0].dt,1);
 assert.notEqual(one.sha256,two.sha256);
 assert.equal(spiralJournalImport(two.events).events.length,2);
 assert.throws(()=>spiralJournalAppend(two.events,a));
 assert.throws(()=>spiralJournalAppend(two.events,spiralEvent({id:'c',time:3}),{maxEvents:2}));
});
test('untrusted journal imports reject malformed and duplicate records',()=>{
 assert.throws(()=>spiralJournalImport([{id:'x',time:1,vertices:null}]));
 const a=spiralEvent({id:'a',time:1});
 assert.throws(()=>spiralJournalImport([a,a]));
});

test('revision links cannot point to missing or future events',()=>{
 const a=spiralEvent({id:'a',time:1,revisionOf:'missing'});
 assert.throws(()=>spiralJournalImport([a]));
 const first=spiralEvent({id:'first',time:1});
 const second=spiralEvent({id:'second',time:2,revisionOf:'first'});
 assert.equal(spiralJournalImport([first,second]).events.length,2);
});
