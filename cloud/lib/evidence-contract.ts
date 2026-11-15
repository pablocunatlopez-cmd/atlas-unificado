/**
 * Typed evidence contract for declaring an improvement of Lía.
 * Client and UI must treat absence as unknown — never as success.
 * Version 1 is a skeleton: the coordinator may not emit records yet.
 */

export const EVIDENCE_CONTRACT_VERSION = 1 as const;

export type EvidenceVerdict = 'passed' | 'failed' | 'rejected' | 'unknown';

export type EvidenceRecord = {
  contractVersion: typeof EVIDENCE_CONTRACT_VERSION;
  taskId: string;
  processId: string;
  artifactId: string;
  sourceRevision: string;
  completedAt: string;
  verdict: EvidenceVerdict;
  testIds: string[];
  criteria: string[];
  /** Opaque server-side reference; never a free-form URL rendered as proof. */
  logRef?: string;
  stableComparison?: 'better' | 'same' | 'worse' | 'unknown';
  integratedRevision?: string;
  reason?: string;
};

const idPattern = /^[a-zA-Z0-9._:-]{1,128}$/;
const revisionPattern = /^[a-zA-Z0-9._/-]{1,160}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}

/**
 * Pure validation. Returns null if the payload is not a complete evidence record.
 * Incomplete objects fail closed — callers must show unknown, not verified.
 */
export function parseEvidenceRecord(input: unknown): EvidenceRecord | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.contractVersion !== EVIDENCE_CONTRACT_VERSION) return null;
  if (!isId(raw.taskId) || !isId(raw.processId) || !isId(raw.artifactId)) return null;
  if (typeof raw.sourceRevision !== 'string' || !revisionPattern.test(raw.sourceRevision)) return null;
  if (!isIsoDate(raw.completedAt)) return null;
  if (!['passed', 'failed', 'rejected', 'unknown'].includes(String(raw.verdict))) return null;
  if (!Array.isArray(raw.testIds) || raw.testIds.length === 0 || raw.testIds.length > 64) return null;
  if (!raw.testIds.every(isId)) return null;
  if (!Array.isArray(raw.criteria) || raw.criteria.length === 0 || raw.criteria.length > 32) return null;
  if (!raw.criteria.every((c) => typeof c === 'string' && c.trim().length > 0 && c.length <= 200)) return null;

  const record: EvidenceRecord = {
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    taskId: raw.taskId,
    processId: raw.processId,
    artifactId: raw.artifactId,
    sourceRevision: raw.sourceRevision,
    completedAt: new Date(raw.completedAt as string).toISOString(),
    verdict: raw.verdict as EvidenceVerdict,
    testIds: raw.testIds as string[],
    criteria: (raw.criteria as string[]).map((c) => c.trim().slice(0, 200)),
  };

  if (typeof raw.logRef === 'string' && idPattern.test(raw.logRef)) record.logRef = raw.logRef;
  if (raw.stableComparison && ['better', 'same', 'worse', 'unknown'].includes(String(raw.stableComparison))) {
    record.stableComparison = raw.stableComparison as EvidenceRecord['stableComparison'];
  }
  if (typeof raw.integratedRevision === 'string' && revisionPattern.test(raw.integratedRevision)) {
    record.integratedRevision = raw.integratedRevision;
  }
  if (typeof raw.reason === 'string' && raw.reason.trim()) {
    record.reason = raw.reason.replace(/\s+/g, ' ').trim().slice(0, 240);
  }
  return record;
}

/** UI-facing label. Only `passed` with a valid record may say verified-capable text later. */
export function evidenceDisplayState(record: EvidenceRecord | null): {
  state: 'unknown' | 'failed' | 'rejected' | 'passed_reported';
  label: string;
  mayClaimIntegrated: boolean;
} {
  if (!record) {
    return {state: 'unknown', label: 'Sin evidencia tipada', mayClaimIntegrated: false};
  }
  if (record.verdict === 'failed') {
    return {state: 'failed', label: 'Prueba fallida (reportada)', mayClaimIntegrated: false};
  }
  if (record.verdict === 'rejected') {
    return {state: 'rejected', label: 'Candidata rechazada', mayClaimIntegrated: false};
  }
  if (record.verdict === 'passed') {
    // Passed tests alone are not integration. integratedRevision is required to claim it.
    const integrated = typeof record.integratedRevision === 'string' && record.integratedRevision.length > 0;
    return {
      state: 'passed_reported',
      label: integrated ? 'Integrada (revisión citada)' : 'Pruebas superadas (sin integración citada)',
      mayClaimIntegrated: integrated,
    };
  }
  return {state: 'unknown', label: 'Evidencia desconocida', mayClaimIntegrated: false};
}
