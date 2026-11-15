/**
 * Publish typed evidence from the PC to Sites.
 * Uses the bridge bearer token — never the browser session.
 */

export const EVIDENCE_CONTRACT_VERSION = 1;

const idPattern = /^[a-zA-Z0-9._:-]{1,128}$/;
const revisionPattern = /^[a-zA-Z0-9._/-]{1,160}$/;

/**
 * @param {object} input
 * @returns {object|null}
 */
export function buildEvidenceRecord(input) {
  if (!input || typeof input !== 'object') return null;
  const {
    taskId,
    processId,
    artifactId,
    sourceRevision,
    completedAt = new Date().toISOString(),
    verdict,
    testIds,
    criteria,
    logRef,
    stableComparison,
    integratedRevision,
    reason,
  } = input;
  if (![taskId, processId, artifactId].every((v) => typeof v === 'string' && idPattern.test(v))) return null;
  if (typeof sourceRevision !== 'string' || !revisionPattern.test(sourceRevision)) return null;
  if (!Number.isFinite(Date.parse(completedAt))) return null;
  if (!['passed', 'failed', 'rejected', 'unknown'].includes(verdict)) return null;
  if (!Array.isArray(testIds) || testIds.length === 0 || !testIds.every((id) => idPattern.test(id))) return null;
  if (!Array.isArray(criteria) || criteria.length === 0 || !criteria.every((c) => typeof c === 'string' && c.trim())) return null;

  const record = {
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    taskId,
    processId,
    artifactId,
    sourceRevision,
    completedAt: new Date(completedAt).toISOString(),
    verdict,
    testIds: testIds.slice(0, 64),
    criteria: criteria.map((c) => c.trim().slice(0, 200)).slice(0, 32),
  };
  if (typeof logRef === 'string' && idPattern.test(logRef)) record.logRef = logRef;
  if (['better', 'same', 'worse', 'unknown'].includes(stableComparison)) record.stableComparison = stableComparison;
  // integratedRevision is optional and must only be set when a real merge/revision exists.
  if (typeof integratedRevision === 'string' && revisionPattern.test(integratedRevision)) {
    record.integratedRevision = integratedRevision;
  }
  if (typeof reason === 'string' && reason.trim()) record.reason = reason.replace(/\s+/g, ' ').trim().slice(0, 240);
  return record;
}

/**
 * @param {string} siteUrl
 * @param {string} token
 * @param {object|object[]} records
 * @param {{request?: typeof fetch, signal?: AbortSignal}} [opts]
 */
export async function publishEvidence(siteUrl, token, records, {request = fetch, signal} = {}) {
  const list = (Array.isArray(records) ? records : [records])
    .map((item) => buildEvidenceRecord(item))
    .filter(Boolean);
  if (list.length === 0) return {ok: false, error: 'no_valid_records'};
  const base = String(siteUrl || '').replace(/\/+$/, '');
  const response = await request(base + '/api/cloud/evidence', {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({records: list}),
  });
  const body = await response.json().catch(() => null);
  return {ok: response.ok && body?.ok === true, status: response.status, body};
}
