/**
 * Session-bound work heartbeat contract (P3 preparation).
 * Presence of this module does NOT start autonomous improvement.
 * A heartbeat only proves the tab is visible and the user opted in.
 */

export const SESSION_HEARTBEAT_VERSION = 1 as const;

export type SessionHeartbeat = {
  contractVersion: typeof SESSION_HEARTBEAT_VERSION;
  /** Opaque client session id (not a user secret). */
  sessionId: string;
  /** ISO time when the client sent the beat. */
  at: string;
  /** Tab must be visible; hidden tabs must stop sending. */
  visible: boolean;
  /** Explicit user opt-in for live coordinator work. */
  liveWorkEnabled: boolean;
  /** Optional focus room for prioritization (never invents work). */
  room?: string;
};

const sessionIdPattern = /^[a-zA-Z0-9_-]{8,64}$/;
const roomPattern = /^[a-z0-9_-]{1,40}$/;

export function parseSessionHeartbeat(input: unknown): SessionHeartbeat | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.contractVersion !== SESSION_HEARTBEAT_VERSION) return null;
  if (typeof raw.sessionId !== 'string' || !sessionIdPattern.test(raw.sessionId)) return null;
  if (typeof raw.at !== 'string' || !Number.isFinite(Date.parse(raw.at))) return null;
  if (typeof raw.visible !== 'boolean' || typeof raw.liveWorkEnabled !== 'boolean') return null;
  // Fail closed: hidden tab or opt-out cannot authorize work.
  if (!raw.visible || !raw.liveWorkEnabled) return null;
  const beat: SessionHeartbeat = {
    contractVersion: SESSION_HEARTBEAT_VERSION,
    sessionId: raw.sessionId,
    at: new Date(raw.at).toISOString(),
    visible: true,
    liveWorkEnabled: true,
  };
  if (typeof raw.room === 'string' && roomPattern.test(raw.room)) beat.room = raw.room;
  return beat;
}

export function heartbeatAllowsWork(beat: SessionHeartbeat | null, {now = Date.now(), maxAgeMs = 30000} = {}): boolean {
  if (!beat) return false;
  const age = now - Date.parse(beat.at);
  if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return false;
  return beat.visible && beat.liveWorkEnabled;
}
