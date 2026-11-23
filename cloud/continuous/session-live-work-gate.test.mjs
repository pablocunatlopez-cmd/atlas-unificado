import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSessionLiveWork, readSessionLiveWork} from './session-live-work-gate.mjs';

test('evaluateSessionLiveWork fails closed without payload or cycle flag', () => {
  assert.equal(evaluateSessionLiveWork(null).mayStartLiveWork, false);
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled: false, activeSessions: 3}).reason, 'live_cycle_disabled');
  assert.equal(evaluateSessionLiveWork({liveCycleEnabled: true, activeSessions: 0, recent: []}).reason, 'no_fresh_opt_in');
});

test('evaluateSessionLiveWork allows only when cycle is on and sessions are fresh', () => {
  const now = Date.parse('2026-11-15T17:00:00Z');
  const allowed = evaluateSessionLiveWork(
    {
      liveCycleEnabled: true,
      activeSessions: 1,
      recent: [{sessionId: 'sess_a', at: new Date(now - 5000).toISOString(), allowsWork: true, ageMs: 5000}],
    },
    {now},
  );
  assert.equal(allowed.mayStartLiveWork, true);
  assert.equal(allowed.reason, 'allowed');

  const stale = evaluateSessionLiveWork(
    {
      liveCycleEnabled: true,
      activeSessions: 0,
      recent: [{sessionId: 'sess_b', at: new Date(now - 200000).toISOString(), allowsWork: true, ageMs: 200000}],
    },
    {now, maxAgeMs: 120000},
  );
  assert.equal(stale.mayStartLiveWork, false);
  assert.equal(stale.reason, 'no_fresh_opt_in');
});

test('readSessionLiveWork treats network errors as no permission', async () => {
  const gate = await readSessionLiveWork('https://example.invalid', {
    request: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(gate.mayStartLiveWork, false);
  assert.equal(gate.reason, 'missing_payload');
});
