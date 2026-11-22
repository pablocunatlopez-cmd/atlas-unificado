import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeAtlasRouterFixture,auditAtlasRouterFixture} from './atlas-router-bilingual-fixture.mjs';
test('synthetic bilingual fixture has at least 50 labeled cases and no duplicate IDs',()=>{
 const cases=makeAtlasRouterFixture();
 assert.ok(cases.length>=50);
 assert.equal(new Set(cases.map(x=>x.id)).size,cases.length);
 assert.ok(cases.some(x=>x.question.includes('¿')));
 assert.ok(cases.some(x=>x.question.includes('Explain')));
});
test('routing audit reports actual mistakes and cannot approve deployment',()=>{
 const report=auditAtlasRouterFixture();
 assert.equal(report.cases,55);
 assert.equal(report.adequateSample,true);
 assert.equal(report.eligibleForProductionRouting,false);
 assert.equal(report.independentGroundTruth,false);
 assert.equal(report.autoSwitch,false);
 assert.ok(report.accuracy>=0&&report.accuracy<=1);
 assert.equal(report.errors.length,report.cases-Math.round(report.accuracy*report.cases));
});
