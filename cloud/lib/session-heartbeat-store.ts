import type {SessionHeartbeat} from './session-heartbeat';
import {heartbeatAllowsWork} from './session-heartbeat';

/** Ephemeral, per-isolate. Not durable storage and not a work queue. */
const MAX_SESSIONS = 64;

type StoredBeat = {
  beat: SessionHeartbeat;
  receivedAt: number;
};

const sessions = new Map<string, StoredBeat>();

export function rememberHeartbeat(beat: SessionHeartbeat, receivedAt = Date.now()): void {
  sessions.set(beat.sessionId, {beat, receivedAt});
  if (sessions.size <= MAX_SESSIONS) return;
  // Drop oldest by receivedAt
  const ordered = [...sessions.entries()].sort((a, b) => a[1].receivedAt - b[1].receivedAt);
  for (const [id] of ordered.slice(0, sessions.size - MAX_SESSIONS)) sessions.delete(id);
}

export function listRecentHeartbeats({now = Date.now(), maxAgeMs = 120000} = {}) {
  const rows: {
    sessionId: string;
    at: string;
    room: string | null;
    allowsWork: boolean;
    ageMs: number;
  }[] = [];
  for (const {beat, receivedAt} of sessions.values()) {
    const ageMs = now - receivedAt;
    if (ageMs > maxAgeMs) continue;
    rows.push({
      sessionId: beat.sessionId,
      at: beat.at,
      room: beat.room ?? null,
      allowsWork: heartbeatAllowsWork(beat, {now, maxAgeMs: 30000}),
      ageMs,
    });
  }
  rows.sort((a, b) => a.ageMs - b.ageMs);
  return rows.slice(0, 16);
}

export function clearHeartbeatStoreForTests() {
  sessions.clear();
}
