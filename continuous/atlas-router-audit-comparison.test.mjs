import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAtlasRetrievalRouter} from './atlas-retrieval-router-audit.mjs';
import {compareAtlasRouterAudits} from './atlas-router-audit-comparison.mjs';
const cases=[{id:'one',question:'¿Cómo funciona?',expected:'conceptual'},
 {id:'two',question:'Find Q594',expected:'exact-identifier'},
 {id:'three',question:'memoria',expected:'ambiguous'}];
test('question or expected label changes invalidate comparisons',()=>{
 const a=evaluateAtlasRetrievalRouter(cases);
 const changed=evaluateAtlasRetrievalRouter(cases.map((c,i)=>i?c:{...c,question:'¿Por qué funciona?'}));
 const relabeled=evaluateAtlasRetrievalRouter(cases.map((c,i)=>i?c:{...c,expected:'ambiguous'}));
 assert.notEqual(a.fixtureHash,changed.fixtureHash);
 assert.equal(compareAtlasRouterAudits(a,changed,{minimumCases:1}).verdict,'incomparable-fixtures');
 assert.equal(compareAtlasRouterAudits(a,relabeled,{minimumCases:1}).comparable,false);
});
test('same fixture remains review-only and insufficient samples never approve',()=>{
 const a=evaluateAtlasRetrievalRouter(cases);
 const small=compareAtlasRouterAudits(a,a);
 assert.equal(small.verdict,'insufficient-evidence');
 const enough=compareAtlasRouterAudits(a,a,{minimumCases:3});
 assert.equal(enough.verdict,'human-review');
 assert.equal(enough.autoSwitch,false);
 assert.equal(enough.accuracyDelta,0);
});
test('class-level false-positive regressions retain baseline',()=>{
 const a=evaluateAtlasRetrievalRouter(cases);
 const b={...a,perClass:{...a.perClass,conceptual:{...a.perClass.conceptual,falsePositives:a.perClass.conceptual.falsePositives+1}}};
 assert.equal(compareAtlasRouterAudits(a,b,{minimumCases:3}).verdict,'retain-baseline');
});
