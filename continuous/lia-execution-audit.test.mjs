import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizeLiaExecutionAudit} from './lia-execution-audit.mjs';
test('completed local review is recorded without claiming factual verification',()=>{
 const audit=sanitizeLiaExecutionAudit({reviewed:true,citationAudit:{unknownLabels:['[9]']},sources:[{}],webRead:true});
 assert.equal(audit.review,'completed');
 assert.equal(audit.revision,'answer-revised-without-diff');
 assert.equal(audit.factualAccuracyVerified,false);
 assert.deepEqual(audit.unknownCitationLabels,['[9]']);
});
test('missing and failed review metadata remain explicit',()=>{
 assert.equal(sanitizeLiaExecutionAudit({answer:'hello'}),null);
 assert.equal(sanitizeLiaExecutionAudit({reviewError:'timeout'}).review,'failed');
 assert.equal(sanitizeLiaExecutionAudit(null),null);
});
test('bridge forwards and queue stores actual local audit, without invented hypothesis',()=>{
 const bridge=readFileSync(new URL('./atlas-cloud-bridge.mjs',import.meta.url),'utf8');
 const queue=readFileSync(new URL('../cloud/lib/cloud/queue.mjs',import.meta.url),'utf8');
 assert.match(bridge,/liaExecutionAudit:sanitizeLiaExecutionAudit\(result\)/);
 assert.match(queue,/value\.liaExecutionAudit=/);
 assert.match(queue,/hypothesis:'not-recorded'/);
 assert.match(queue,/audit:result\?\.liaExecutionAudit\|\|null/);
});
