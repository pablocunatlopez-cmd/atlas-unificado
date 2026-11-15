import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_HEARTBEAT_VERSION,
  heartbeatAllowsWork,
  parseSessionHeartbeat,
} from './session-heartbeat.ts';

const base = {
  contractVersion: SESSION_HEARTBEAT_VERSION,
  sessionId: 'session-abc-12345',
  at: '2026-11-15T16:00:00Z',
  visible: true,
  liveWorkEnabled: true,
  room: 'salon',
};

test('parseSessionHeartbeat accepts a valid opt-in visible beat', () => {
  const beat = parseSessionHeartbeat(base);
  assert.ok(beat);
  assert.equal(beat!.sessionId, 'session-abc-12345');
  assert.equal(beat!.room, 'salon');
  assert.equal(beat!.visible, true);
});

test('parseSessionHeartbeat rejects hidden, opt-out, bad version and bad ids', () => {
  assert.equal(parseSessionHeartbeat({...base, visible: false}), null);
  assert.equal(parseSessionHeartbeat({...base, liveWorkEnabled: false}), null);
  assert.equal(parseSessionHeartbeat({...base, contractVersion: 99}), null);
  assert.equal(parseSessionHeartbeat({...base, sessionId: 'short'}), null);
  assert.equal(parseSessionHeartbeat({...base, at: 'nope'}), null);
  assert.equal(parseSessionHeartbeat(null), null);
});

test('heartbeatAllowsWork enforces freshness window', () => {
  const beat = parseSessionHeartbeat(base);
  const now = Date.parse(base.at);
  assert.equal(heartbeatAllowsWork(beat, {now, maxAgeMs: 30000}), true);
  assert.equal(heartbeatAllowsWork(beat, {now: now + 60000, maxAgeMs: 30000}), false);
  assert.equal(heartbeatAllowsWork(null, {now}), false);
});
