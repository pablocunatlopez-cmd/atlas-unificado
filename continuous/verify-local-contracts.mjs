/**
 * Offline smoke checks for contracts used by the bridge and UI.
 * Does not call Sites. Exit 0 only if all assertions pass.
 */
import assert from 'node:assert/strict';
import {buildEvidenceRecord} from './evidence-publish.mjs';
import {recordsFromAutonomyReport} from './typed-evidence-from-report.mjs';
import {evaluateSessionLiveWork, readSessionLiveWork} from './session-live-work-gate.mjs';

const record = buildEvidenceRecord({
  taskId: 'smoke-task',
  processId: 'tools',
  artifactId: 'smoke-artifact',
  sourceRevision: 'local/smoke',
  completedAt: '2026-11-15T17:00:00Z',
  verdict: 'passed',
  testIds: ['smoke-test'],
  criteria: ['offline contract check'],
});
assert.ok(record);
assert.equal(record.contractVersion, 1);
assert.equal(record.integratedRevision, undefined);

const fromReport = recordsFromAutonomyReport({
  at: '2026-11-15T17:00:00Z',
  candidate: {id: 'ext-smoke', curriculumTaskId: 'smoke-curriculum', passed: false},
  checks: [{id: 'json-pointer-resolve', passed: true}],
});
assert.ok(fromReport.length >= 2);
assert.ok(fromReport.every((item) => !item.integratedRevision));

const closed = evaluateSessionLiveWork({
  liveCycleEnabled: false,
  activeSessions: 3,
  recent: [{at: new Date().toISOString(), allowsWork: true}],
});
assert.equal(closed.mayStartLiveWork, false);
assert.equal(closed.reason, 'live_cycle_disabled');

const open = evaluateSessionLiveWork({
  liveCycleEnabled: true,
  activeSessions: 1,
  recent: [{at: new Date().toISOString(), allowsWork: true}],
});
assert.equal(open.mayStartLiveWork, true);

const gate = await readSessionLiveWork('https://example.test', {
  request: async () => ({
    ok: true,
    json: async () => ({liveCycleEnabled: false, activeSessions: 0, recent: []}),
  }),
});
assert.equal(gate.mayStartLiveWork, false);

console.log(
  JSON.stringify({
    ok: true,
    evidenceRecord: true,
    reportMapping: fromReport.length,
    gateClosed: closed.mayStartLiveWork,
    gateOpen: open.mayStartLiveWork,
  }),
);
