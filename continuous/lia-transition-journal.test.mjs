import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendLiaTransitionJournal,verifyLiaTransitionJournal} from './lia-transition-journal.mjs';
const input={id:'event-1',hypothesisId:'citation-check',timestamp:'2026-11-16T14:00:00Z',previousStatus:'testing',check:{kind:'citation-audit',executed:true,outcome:'fail',reference:'chat:audit'}};
test('links executed transitions with stable hashes',()=>{
 const one=appendLiaTransitionJournal([],input);
 const two=appendLiaTransitionJournal(one,{...input,id:'event-2',timestamp:'2026-11-16T14:01:00Z',previousStatus:'refuted',check:{...input.check,outcome:'pass'}});
 assert.equal(two[1].previousHash,two[0].hash);
 assert.equal(two[1].transition.nextStatus,'supported');
 assert.equal(verifyLiaTransitionJournal(two),true);
});
test('rejects tampering, duplicated event IDs and fabricated executions',()=>{
 const records=appendLiaTransitionJournal([],input);
 assert.equal(verifyLiaTransitionJournal([{...records[0],transition:{...records[0].transition,nextStatus:'supported'}}]),false);
 assert.throws(()=>appendLiaTransitionJournal(records,input));
 assert.throws(()=>appendLiaTransitionJournal([],{...input,check:{...input.check,executed:false}}));
});
