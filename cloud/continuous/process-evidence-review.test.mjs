import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewEvidenceReport} from './process-evidence-review.mjs';

const hash='a'.repeat(64),base={version:1,taskId:'task-17',processId:'experience',artifactId:'artifact-3',artifactRevision:hash,completedAt:'2026-11-14T12:00:00.000Z',tests:[{id:'unit',version:'1',outcome:'passed'}],comparison:{baselineRevision:'b'.repeat(64),candidateRevision:hash,outcome:'improved',reason:'Criterios declarados superados.'},decision:{outcome:'accepted',reason:'Cumple los criterios declarados.'}};
const now=Date.parse('2026-11-15T12:00:00Z');

test('consistent accepted report is still only reported and not verified',()=>{
 const result=reviewEvidenceReport(base,{now});assert.equal(result.status,'consistent_report');assert.equal(result.claim,'reported');
});

test('accepted decision conflicts with any failing test or non-improving comparison',()=>{
 const failed=structuredClone(base);failed.tests.push({id:'integration',version:'1',outcome:'failed'});assert.equal(reviewEvidenceReport(failed,{now}).status,'inconsistent');
 const unchanged=structuredClone(base);unchanged.comparison.outcome='unchanged';assert.equal(reviewEvidenceReport(unchanged,{now}).status,'inconsistent');
});

test('rejection cannot contradict all-passed tests and reported improvement',()=>{
 const value={...structuredClone(base),decision:{outcome:'rejected',reason:'No cumple.'}};assert.equal(reviewEvidenceReport(value,{now}).status,'inconsistent');
});

test('integration requires accepted, passing, improved report and a later timestamp',()=>{
 const valid={...structuredClone(base),integration:{revision:'c'.repeat(64),at:'2026-11-14T12:01:00Z'}};assert.equal(reviewEvidenceReport(valid,{now}).status,'consistent_report');
 const early={...structuredClone(valid),integration:{...valid.integration,at:'2026-11-14T11:59:00Z'}};assert.equal(reviewEvidenceReport(early,{now}).status,'inconsistent');
 const failed={...structuredClone(valid),tests:[{id:'unit',version:'1',outcome:'failed'}]};assert.equal(reviewEvidenceReport(failed,{now}).status,'inconsistent');
});

test('invalid or stale shape results remain fail-closed',()=>{
 assert.equal(reviewEvidenceReport(null,{now}).status,'absent');
 assert.equal(reviewEvidenceReport(base,{now:Date.parse('2027-01-01T00:00:00Z')}).status,'stale');
});
