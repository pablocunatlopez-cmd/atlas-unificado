import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLiaHypothesis,buildLiaHypothesisLedger} from './lia-hypothesis-ledger.mjs';
const entry={id:'h1',claim:'Una hipótesis explícita',status:'proposed',origin:'model',evidence:[],revisionOf:null};
test('records explicit hypotheses and valid revision lineage',()=>{
 const records=buildLiaHypothesisLedger([entry,{...entry,id:'h2',status:'refuted',revisionOf:'h1',evidence:[{type:'tool-output',reference:'job:123',verified:true}]}]);
 assert.equal(records[1].revisionOf,'h1');
 assert.equal(records[1].evidence[0].verified,true);
 assert.equal(records[1].factualAccuracyVerified,false);
});
test('rejects unsupported evidence, duplicate IDs and future revisions',()=>{
 assert.throws(()=>validateLiaHypothesis({...entry,status:'proven'}));
 assert.throws(()=>buildLiaHypothesisLedger([entry,entry]));
 assert.throws(()=>buildLiaHypothesisLedger([{...entry,revisionOf:'missing'}]));
 assert.equal(validateLiaHypothesis({...entry,evidence:[{type:'user-report',reference:'said',verified:true}]}).evidence[0].verified,false);
});
test('bridge, queue and viewer use the same explicit ledger',()=>{
 const bridge=readFileSync(new URL('./atlas-cloud-bridge.mjs',import.meta.url),'utf8');
 const queue=readFileSync(new URL('../cloud/lib/cloud/queue.mjs',import.meta.url),'utf8');
 const view=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(bridge,/buildLiaHypothesisLedger\(result\.liaHypotheses\)/);
 assert.match(queue,/value\.liaHypotheses=buildLiaHypothesisLedger/);
 assert.match(view,/hypothesis\.revisionOf/);
});
