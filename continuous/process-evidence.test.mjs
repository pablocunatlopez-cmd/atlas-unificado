import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEvidenceResult} from './process-evidence.mjs';

const hash='a'.repeat(64),base={version:1,taskId:'task-17',processId:'experience',artifactId:'artifact-3',artifactRevision:hash,completedAt:'2026-11-14T12:00:00.000Z',tests:[{id:'unit',version:'1',outcome:'passed'}],comparison:{baselineRevision:'b'.repeat(64),candidateRevision:hash,outcome:'improved',reason:'Mejora en los criterios acordados.'},decision:{outcome:'accepted',reason:'Cumple los criterios declarados.'}};

test('absence is not success and a complete coordinator report remains unverified',()=>{
 assert.deepEqual(inspectEvidenceResult(null),{status:'absent',claim:'none'});
 assert.equal(inspectEvidenceResult(base,{now:Date.parse('2026-11-15T12:00:00Z')}).status,'ready_for_review');
 assert.equal(inspectEvidenceResult(base,{now:Date.parse('2026-11-15T12:00:00Z')}).claim,'reported');
});

test('missing tests, comparison or decision cannot become review-ready',()=>{
 for(const field of ['tests','comparison','decision']){const value=structuredClone(base);delete value[field];assert.equal(inspectEvidenceResult(value,{now:Date.parse('2026-11-15T12:00:00Z')}).status,'incomplete',field);}
});

test('malformed, future-dated and stale reports fail closed',()=>{
 assert.equal(inspectEvidenceResult({...base,artifactRevision:'not-a-hash'},{now:Date.parse('2026-11-15T12:00:00Z')}).status,'invalid');
 assert.equal(inspectEvidenceResult({...base,completedAt:'2026-11-16T12:00:00Z'},{now:Date.parse('2026-11-15T12:00:00Z')}).status,'invalid');
 assert.equal(inspectEvidenceResult(base,{now:Date.parse('2027-01-01T00:00:00Z')}).status,'stale');
});

test('integration requires an accepted decision and a valid destination revision',()=>{
 const integrated={...base,integration:{revision:'c'.repeat(64),at:'2026-11-14T12:01:00Z'}};
 assert.equal(inspectEvidenceResult(integrated,{now:Date.parse('2026-11-15T12:00:00Z')}).hasIntegration,true);
 assert.equal(inspectEvidenceResult({...integrated,decision:{outcome:'rejected',reason:'No.'}},{now:Date.parse('2026-11-15T12:00:00Z')}).status,'invalid');
});

test('caller data is not mutated and unknown fields do not leak into the projection',()=>{
 const value=structuredClone(base);value.secret='do-not-project';const before=structuredClone(value),result=inspectEvidenceResult(value,{now:Date.parse('2026-11-15T12:00:00Z')});
 assert.deepEqual(value,before);assert.equal(Object.hasOwn(result,'secret'),false);assert.equal(result.status,'ready_for_review');
});
