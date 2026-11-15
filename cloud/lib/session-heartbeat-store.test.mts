import test from 'node:test';
import assert from 'node:assert/strict';
import {SESSION_HEARTBEAT_VERSION, parseSessionHeartbeat} from './session-heartbeat.ts';
import {
  clearHeartbeatStoreForTests,
  listRecentHeartbeats,
  rememberHeartbeat,
} from './session-heartbeat-store.ts';

test('rememberHeartbeat lists fresh sessions and ignores stale ones', () => {
  clearHeartbeatStoreForTests();
  const now = Date.parse('2026-11-15T16:00:00Z');
  const beat = parseSessionHeartbeat({
    contractVersion: SESSION_HEARTBEAT_VERSION,
    sessionId: 'session-store-test-1',
    at: new Date(now).toISOString(),
    visible: true,
    liveWorkEnabled: true,
    room: 'salon',
  });
  assert.ok(beat);
  rememberHeartbeat(beat!, now);
  const fresh = listRecentHeartbeats({now, maxAgeMs: 120000});
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].sessionId, 'session-store-test-1');
  assert.equal(fresh[0].allowsWork, true);

  const stale = listRecentHeartbeats({now: now + 200000, maxAgeMs: 120000});
  assert.equal(stale.length, 0);
  clearHeartbeatStoreForTests();
});
