import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveLiaAuditHypotheses} from './lia-audit-hypotheses.mjs';
test('actual completed review and clean citation audit produce bounded explicit claims',()=>{
 const records=deriveLiaAuditHypotheses({reviewed:true,citationAudit:{unknownLabels:[]}});
 assert.equal(records.length,2);
 assert.equal(records[0].status,'supported');
 assert.equal(records[1].status,'supported');
 assert.ok(records.every(x=>x.factualAccuracyVerified===false));
});
test('failed review and unresolved citations are not represented as success',()=>{
 const records=deriveLiaAuditHypotheses({reviewError:'timeout',citationAudit:{unknownLabels:['missing']}});
 assert.equal(records[0].status,'inconclusive');
 assert.equal(records[1].status,'refuted');
 assert.match(records[1].conclusion,/missing/);
});
test('no fabricated hypotheses when no audit ran',()=>{
 assert.deepEqual(deriveLiaAuditHypotheses(),[]);
 const source=readFileSync(new URL('./chat.mjs',import.meta.url),'utf8');
 assert.match(source,/liaHypotheses:deriveLiaAuditHypotheses\(\{reviewed,reviewError,citationAudit,sources\}\)/);
});
