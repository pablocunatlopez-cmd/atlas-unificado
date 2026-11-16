import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectLiaHypothesisTimeline} from './lia-hypothesis-timeline.mjs';
const job=(id,status,claim='The check passed')=>({id,status:'completed',updatedAt:'2026-11-16T13:00:00Z',hypotheses:[{id:'citation-check',claim,status,origin:'tool',evidence:[]}]});
test('tracks explicit status changes without asserting learning or truth',()=>{
 const items=projectLiaHypothesisTimeline([job('a','supported'),job('b','refuted'),job('c','refuted')]);
 assert.equal(items.length,3);
 assert.equal(items[1].priorRecordId,'a:citation-check');
 assert.equal(items[1].statusChanged,true);
 assert.equal(items[2].comparison,'same-status');
 assert.ok(items.every(x=>x.factualAccuracyVerified===false));
});
test('ignores pending work and unrelated claims',()=>{
 const items=projectLiaHypothesisTimeline([job('a','supported'),{...job('b','refuted'),status:'running'},job('c','inconclusive','Other claim')]);
 assert.equal(items.length,2);
 assert.equal(items[1].priorRecordId,null);
 assert.throws(()=>projectLiaHypothesisTimeline([], {limit:300}));
});
test('authenticated endpoint and viewer use comparison timeline',()=>{
 const route=readFileSync(new URL('../cloud/app/api/lia-world/conversations/[id]/route.ts',import.meta.url),'utf8');
 const view=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(route,/projectLiaHypothesisTimeline\(execution\.events\)/);
 assert.match(view,/Comparación de hipótesis registradas/);
});

test('distinguishes a recorded new evidence reference from a causally unexplained status change',()=>{
 const first=job('a','supported');
 first.hypotheses[0].evidence=[{type:'tool-output',reference:'check:1'}];
 const second=job('b','refuted');
 second.hypotheses[0].evidence=[{type:'tool-output',reference:'check:1'},{type:'tool-output',reference:'check:2'}];
 const third=job('c','inconclusive');
 third.hypotheses[0].evidence=second.hypotheses[0].evidence;
 const timeline=projectLiaHypothesisTimeline([first,second,third]);
 assert.deepEqual(timeline[1].newEvidenceReferences,['tool-output:check:2']);
 assert.match(timeline[1].changeExplanation,/newly referenced evidence/);
 assert.deepEqual(timeline[2].newEvidenceReferences,[]);
 assert.match(timeline[2].changeExplanation,/without newly referenced evidence/);
});
