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

test('a reported result or revision never establishes verification or integration', () => {
  assert.deepEqual(evidenceDisplayState(null), {
    state: 'unknown',
    label: 'Sin evidencia tipada',
    mayClaimIntegrated: false,
  });

  const passed = parseEvidenceRecord(base);
  const display = evidenceDisplayState(passed);
  assert.equal(display.state, 'passed_reported');
  assert.equal(display.mayClaimIntegrated, false);
  assert.match(display.label, /reportadas/i);

  const cited = parseEvidenceRecord({...base, integratedRevision: 'main/deadbeef', verified: true});
  assert.equal(cited?.integratedRevision, 'main/deadbeef');
  const citedDisplay = evidenceDisplayState(cited);
  assert.equal(citedDisplay.mayClaimIntegrated, false);
  assert.match(citedDisplay.label, /reportadas/i);
});

test('failed and rejected verdicts stay non-integrated', () => {
  const failed = parseEvidenceRecord({...base, verdict: 'failed', reason: 'external suite failed'});
  assert.equal(evidenceDisplayState(failed).mayClaimIntegrated, false);
  assert.equal(evidenceDisplayState(failed).state, 'failed');

  const rejected = parseEvidenceRecord({...base, verdict: 'rejected'});
  assert.equal(evidenceDisplayState(rejected).state, 'rejected');
  assert.equal(evidenceDisplayState(rejected).mayClaimIntegrated, false);
  assert.match(evidenceDisplayState(rejected).label, /reportado/i);
  assert.equal(evidenceDisplayState(parseEvidenceRecord({...base, verdict:'unknown', integratedRevision:'main/abc'})).state, 'unknown');
});
