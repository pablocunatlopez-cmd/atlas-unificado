import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_CONTRACT_VERSION,
  evidenceDisplayState,
  parseEvidenceRecord,
} from './evidence-contract.ts';

const base = {
  contractVersion: EVIDENCE_CONTRACT_VERSION,
  taskId: 'task-abc',
  processId: 'experience',
  artifactId: 'art-1',
  sourceRevision: 'abc123def',
  completedAt: '2026-11-15T12:00:00Z',
  verdict: 'passed' as const,
  testIds: ['suite.external.v1'],
  criteria: ['external-to-generator'],
};

test('parseEvidenceRecord accepts a complete v1 record', () => {
  const record = parseEvidenceRecord(base);
  assert.ok(record);
  assert.equal(record!.contractVersion, 1);
  assert.equal(record!.taskId, 'task-abc');
  assert.equal(record!.completedAt, '2026-11-15T12:00:00.000Z');
});

test('parseEvidenceRecord rejects wrong version, empty tests, and missing fields', () => {
  assert.equal(parseEvidenceRecord(null), null);
  assert.equal(parseEvidenceRecord({...base, contractVersion: 99}), null);
  assert.equal(parseEvidenceRecord({...base, testIds: []}), null);
  assert.equal(parseEvidenceRecord({...base, criteria: []}), null);
  assert.equal(parseEvidenceRecord({...base, taskId: ''}), null);
  assert.equal(parseEvidenceRecord({...base, completedAt: 'not-a-date'}), null);
  assert.equal(parseEvidenceRecord({...base, verdict: 'verified'}), null);
});

test('evidenceDisplayState never claims integration without integratedRevision', () => {
  assert.deepEqual(evidenceDisplayState(null), {
    state: 'unknown',
    label: 'Sin evidencia tipada',
    mayClaimIntegrated: false,
  });

  const passed = parseEvidenceRecord(base);
  const display = evidenceDisplayState(passed);
  assert.equal(display.state, 'reported');
  assert.equal(display.mayClaimIntegrated, false);
  assert.match(display.label, /sin integración/i);

  const integrated = parseEvidenceRecord({...base, integratedRevision: 'main@deadbeef'});
  const integratedDisplay = evidenceDisplayState(integrated);
  assert.equal(integratedDisplay.state, 'integrated');
  assert.equal(integratedDisplay.mayClaimIntegrated, true);
  assert.match(integratedDisplay.label, /Integrada/);
});

test('failed and rejected verdicts stay non-integrated', () => {
  const failed = parseEvidenceRecord({...base, verdict: 'failed', reason: 'external suite failed'});
  assert.equal(evidenceDisplayState(failed).mayClaimIntegrated, false);
  assert.equal(evidenceDisplayState(failed).state, 'failed');

  const rejected = parseEvidenceRecord({...base, verdict: 'rejected'});
  assert.equal(evidenceDisplayState(rejected).state, 'failed');
  assert.equal(evidenceDisplayState(rejected).mayClaimIntegrated, false);
});
