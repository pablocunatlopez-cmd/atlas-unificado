import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceRecord, publishEvidence} from './evidence-publish.mjs';

const base = {
  taskId: 'curriculum-repair-1',
  processId: 'experience',
  artifactId: 'artifact-demo-1',
  sourceRevision: 'main/abcdef1',
  completedAt: '2026-11-15T16:00:00Z',
  verdict: 'passed',
  testIds: ['test-a', 'test-b'],
  criteria: ['external cases pass', 'no private hypothesis leaked'],
};

test('buildEvidenceRecord accepts a complete payload', () => {
  const record = buildEvidenceRecord(base);
  assert.ok(record);
  assert.equal(record.contractVersion, 1);
  assert.equal(record.verdict, 'passed');
  assert.equal(record.integratedRevision, undefined);
});

test('buildEvidenceRecord rejects incomplete or invented shapes', () => {
  assert.equal(buildEvidenceRecord({...base, testIds: []}), null);
  assert.equal(buildEvidenceRecord({...base, verdict: 'success'}), null);
  assert.equal(buildEvidenceRecord({...base, taskId: ''}), null);
});

test('publishEvidence posts only valid records with bearer token', async () => {
  const calls = [];
  const result = await publishEvidence(
    'https://example.test/',
    'token-abcdefghijklmnopqrstuvwxyz012345',
    base,
    {
      request: async (url, init) => {
        calls.push({url, init});
        return {
          ok: true,
          status: 200,
          json: async () => ({ok: true, accepted: 1}),
        };
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.test/api/cloud/evidence');
  assert.match(calls[0].init.headers.Authorization, /^Bearer /);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.records.length, 1);
  assert.equal(body.records[0].taskId, 'curriculum-repair-1');
});
