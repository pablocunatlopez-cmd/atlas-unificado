/**
 * Pure gate for session-bound live work (P3).
 * The cloud UI may post opt-in heartbeats; this module only interprets
 * the public GET /api/cloud/session-heartbeat payload.
 *
 * mayStartLiveWork is true only when the server flags the live cycle
 * as enabled AND there is at least one fresh opt-in session.
 * Until the cloud flips liveCycleEnabled, the PC must not treat
 * heartbeats as permission to improve Lía on its own.
 */

export function evaluateSessionLiveWork(payload, {now = Date.now(), maxAgeMs = 120000} = {}) {
  if (!payload || typeof payload !== 'object') {
    return {
      liveCycleEnabled: false,
      activeSessions: 0,
      freshSessions: 0,
      mayStartLiveWork: false,
      reason: 'missing_payload',
    };
  }
  const liveCycleEnabled = payload.liveCycleEnabled === true;
  const recent = Array.isArray(payload.recent) ? payload.recent : [];
  let freshSessions = 0;
  for (const row of recent) {
    if (!row || typeof row !== 'object') continue;
    const age =
      typeof row.ageMs === 'number' && Number.isFinite(row.ageMs)
        ? row.ageMs
        : typeof row.at === 'string' && Number.isFinite(Date.parse(row.at))
          ? now - Date.parse(row.at)
          : null;
    if (age === null || age < 0 || age > maxAgeMs) continue;
    if (row.allowsWork === false) continue;
    freshSessions += 1;
  }
  const reported =
    typeof payload.activeSessions === 'number' && Number.isSafeInteger(payload.activeSessions) && payload.activeSessions >= 0
      ? Math.min(payload.activeSessions, 64)
      : freshSessions;
  const activeSessions = Math.max(reported, freshSessions);
  const mayStartLiveWork = liveCycleEnabled && activeSessions > 0;
  return {
    liveCycleEnabled,
    activeSessions,
    freshSessions,
    mayStartLiveWork,
    reason: !liveCycleEnabled
      ? 'live_cycle_disabled'
      : activeSessions === 0
        ? 'no_fresh_opt_in'
        : 'allowed',
  };
}

/**
 * Fetch and evaluate the public heartbeat status endpoint.
 * Never throws; network failures fail closed.
 */
export async function readSessionLiveWork(siteUrl, {request = fetch, signal, maxAgeMs = 120000} = {}) {
  try {
    const base = String(siteUrl || '').replace(/\/+$/, '');
    if (!base) return evaluateSessionLiveWork(null);
    const response = await request(base + '/api/cloud/session-heartbeat', {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
    if (!response.ok) return evaluateSessionLiveWork(null);
    const payload = await response.json();
    return evaluateSessionLiveWork(payload, {maxAgeMs});
  } catch {
    return evaluateSessionLiveWork(null);
  }
}
