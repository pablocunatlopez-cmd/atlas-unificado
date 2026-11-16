import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {journalLiaExecutedChecks} from './lia-execution-journal.mjs';
import {verifyLiaTransitionJournal} from './lia-transition-journal.mjs';
test('only actual supported audit and deterministic tool evidence enters journal',()=>{
 const input=[{id:'citation-check',status:'refuted',evidence:[{type:'tool-output',reference:'chat:citation-audit',verified:true}]},{id:'review-attempt',status:'supported',evidence:[{type:'tool-output',reference:'chat:review',verified:true}]},{id:'validated-tool-result',status:'supported',evidence:[{type:'tool-output',reference:'tool:dag',verified:true}]}];
 const records=journalLiaExecutedChecks(input,{timestamp:'2026-11-16T14:00:00Z'});
 assert.equal(records.length,2);
 assert.equal(records[0].transition.nextStatus,'refuted');
 assert.equal(records[1].transition.nextStatus,'supported');
 assert.equal(verifyLiaTransitionJournal(records),true);
});
test('unverified evidence does not enter journal',()=>{
 assert.deepEqual(journalLiaExecutedChecks([{id:'citation-check',status:'supported',evidence:[{type:'tool-output',reference:'x',verified:false}]}]),[]);
});
test('bridge, cloud queue and viewer expose persistent journal without false cloud verification',()=>{
 const bridge=readFileSync(new URL('./atlas-cloud-bridge.mjs',import.meta.url),'utf8');
 const queue=readFileSync(new URL('../cloud/lib/cloud/queue.mjs',import.meta.url),'utf8');
 const view=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(bridge,/liaTransitionJournal:journalLiaExecutedChecks/);
 assert.match(queue,/value\.liaTransitionJournal=journal\.map/);
 assert.match(queue,/integrityVerifiedInCloud:false/);
 assert.match(view,/Integridad en nube: no verificada/);
});
