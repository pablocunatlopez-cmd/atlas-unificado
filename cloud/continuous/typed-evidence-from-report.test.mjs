import test from 'node:test';
import assert from 'node:assert/strict';
import {recordsFromAutonomyReport} from './typed-evidence-from-report.mjs';

test('candidate and checks produce records without inventing integration', () => {
  const records = recordsFromAutonomyReport({
    at: '2026-11-15T16:00:00Z',
    candidate: {id: 'ext-1', curriculumTaskId: 'merge-intervals', passed: true},
    checks: [{id: 'json-pointer-resolve', passed: false}],
    coreCycle: {id: 'cycle-9', accepted: false},
  });
  assert.equal(records.length, 3);
  assert.ok(records.every((r) => r.contractVersion === 1));
  assert.ok(records.every((r) => r.integratedRevision === undefined));
  assert.equal(records[0].verdict, 'passed');
  assert.equal(records[1].verdict, 'failed');
  assert.equal(records[2].verdict, 'rejected');
});

test('empty or malformed reports yield no evidence', () => {
  assert.deepEqual(recordsFromAutonomyReport(null), []);
  assert.deepEqual(recordsFromAutonomyReport({}), []);
  assert.deepEqual(recordsFromAutonomyReport({candidate: {passed: true}}), []);
});
