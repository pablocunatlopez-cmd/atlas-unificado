/**
 * Session-bound live work authorization. A reported aggregate is telemetry,
 * never proof of a currently consenting session.
 */
export function evaluateSessionLiveWork(payload, {now = Date.now(), maxAgeMs = 120000} = {}) {
  if (!payload || typeof payload !== 'object') {
    return {liveCycleEnabled:false,activeSessions:0,freshSessions:0,mayStartLiveWork:false,reason:'missing_payload'};
  }
  const liveCycleEnabled = payload.liveCycleEnabled === true;
  const recent = Array.isArray(payload.recent) ? payload.recent.slice(0, 64) : [];
  const validMaxAge = Number.isFinite(maxAgeMs) && maxAgeMs > 0 ? Math.min(maxAgeMs, 120000) : 120000;
  let freshSessions = 0;
  for (const row of recent) {
    if (!row || typeof row !== 'object' || row.allowsWork !== true) continue;
    // A timestamp, when supplied, must agree with the reported age.
    // Otherwise a stale opt-in could be revived by an incorrect ageMs=0.
    const reportedAge = typeof row.ageMs === 'number' && Number.isFinite(row.ageMs) ? row.ageMs : null;
    const timestampAge = typeof row.at === 'string' && Number.isFinite(Date.parse(row.at))
      ? now - Date.parse(row.at) : null;
    if (reportedAge === null && timestampAge === null) continue;
    if ([reportedAge,timestampAge].some(age => age !== null && (age < 0 || age > validMaxAge))) continue;
    freshSessions++;
  }
  const reported = Number.isSafeInteger(payload.activeSessions) && payload.activeSessions >= 0
    ? Math.min(payload.activeSessions, 64) : 0;
  const mayStartLiveWork = liveCycleEnabled && freshSessions > 0;
  return {
    liveCycleEnabled,
    activeSessions: reported,
    freshSessions,
    mayStartLiveWork,
    reason: !liveCycleEnabled ? 'live_cycle_disabled' : !freshSessions ? 'no_fresh_opt_in' : 'allowed',
  };
}

/** Network errors, malformed responses and invalid origins fail closed. */
export async function readSessionLiveWork(siteUrl, {request = fetch, signal, maxAgeMs = 120000} = {}) {
  try {
    const base = new URL(siteUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
      return evaluateSessionLiveWork(null);
    }
    const response = await request(base.origin + '/api/cloud/session-heartbeat', {
      method:'GET',cache:'no-store',redirect:'error',signal,
    });
    if (!response.ok) return evaluateSessionLiveWork(null);
    return evaluateSessionLiveWork(await response.json(), {maxAgeMs});
  } catch {
    return evaluateSessionLiveWork(null);
  }
}
