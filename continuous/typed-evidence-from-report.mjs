import {buildEvidenceRecord} from './evidence-publish.mjs';

const idPattern = /^[a-zA-Z0-9._:-]{1,128}$/;

function safeId(value, fallback) {
  if (typeof value === 'string' && idPattern.test(value)) return value;
  if (typeof fallback === 'string' && idPattern.test(fallback)) return fallback;
  return null;
}

/**
 * Build typed evidence records from an autonomous-review report.
 * Never sets integratedRevision — that requires an explicit real merge.
 * @param {object} report
 * @param {{sourceRevision?: string, completedAt?: string}} [opts]
 * @returns {object[]}
 */
export function recordsFromAutonomyReport(report, {sourceRevision = 'local/autonomous-review', completedAt} = {}) {
  if (!report || typeof report !== 'object') return [];
  const at =
    typeof completedAt === 'string' && Number.isFinite(Date.parse(completedAt))
      ? completedAt
      : typeof report.at === 'string' && Number.isFinite(Date.parse(report.at))
        ? report.at
        : new Date().toISOString();
  const records = [];

  const candidate = report.candidate;
  if (candidate && typeof candidate === 'object') {
    const taskId = safeId(candidate.curriculumTaskId, safeId(candidate.taskId, safeId(candidate.id)));
    const artifactId = safeId(candidate.id, taskId);
    if (taskId && artifactId) {
      const passed = candidate.passed === true;
      const record = buildEvidenceRecord({
        taskId,
        processId: 'tools',
        artifactId,
        sourceRevision,
        completedAt: at,
        verdict: passed ? 'passed' : 'failed',
        testIds: [safeId(candidate.contractId, `${taskId}-contract`) || `${taskId}-contract`],
        criteria: [
          passed ? 'Candidate extension passed its local contract cases' : 'Candidate extension failed local contract cases',
          'Does not change Qwen base weights',
        ],
        reason: passed ? 'Autonomous programming candidate accepted locally' : 'Autonomous programming candidate rejected locally',
        stableComparison: 'unknown',
      });
      if (record) records.push(record);
    }
  }

  const checks = Array.isArray(report.checks) ? report.checks : [];
  for (const check of checks.slice(0, 16)) {
    if (!check || typeof check !== 'object') continue;
    const taskId = safeId(check.id, safeId(check.taskId));
    if (!taskId) continue;
    const passed = check.passed === true;
    const record = buildEvidenceRecord({
      taskId,
      processId: 'tools',
      artifactId: `check-${taskId}`,
      sourceRevision,
      completedAt: at,
      verdict: passed ? 'passed' : 'failed',
      testIds: [safeId(check.contractId, `${taskId}-recheck`) || `${taskId}-recheck`],
      criteria: ['Existing extension re-checked by autonomous review', 'Failure marks extension as not passed'],
      reason: passed ? 'Extension re-check passed' : 'Extension re-check failed',
      stableComparison: 'unknown',
    });
    if (record) records.push(record);
  }

  const core = report.coreCycle;
  if (core && typeof core === 'object' && (core.accepted === true || core.accepted === false)) {
    const record = buildEvidenceRecord({
      taskId: 'cognitive-core-policy',
      processId: 'review',
      artifactId: safeId(core.id, `core-${Date.parse(at)}`) || `core-${Date.parse(at)}`,
      sourceRevision,
      completedAt: at,
      verdict: core.accepted ? 'passed' : 'rejected',
      testIds: ['core-reserved-contracts'],
      criteria: [
        'Policy candidate evaluated against reserved contracts',
        'Accepted policy does not imply Qwen weight change',
      ],
      reason: core.accepted ? 'Policy candidate accepted' : 'Policy candidate kept as negative result',
      // Still no integratedRevision: policy file revision must be cited explicitly elsewhere.
      stableComparison: core.accepted ? 'better' : 'same',
    });
    if (record) records.push(record);
  }

  return records;
}
