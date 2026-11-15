import {inspectEvidenceResult} from './process-evidence.mjs';

const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);

/**
 * Check cross-field consistency in an untrusted evidence report. This is not an
 * independent verifier: a consistent report remains a report, never a proof.
 */
export function reviewEvidenceReport(value,options={}){
 const inspected=inspectEvidenceResult(value,options);
 if(inspected.status!=='ready_for_review')return inspected;
 const failedTests=value.tests.some(test=>test.outcome==='failed');
 const passedTests=value.tests.every(test=>test.outcome==='passed');
 const comparison=value.comparison.outcome,decision=value.decision.outcome;
 const issues=[];
 if(decision==='accepted'&&(!passedTests||comparison!=='improved'))issues.push('acceptance_requires_passed_tests_and_improvement');
 if(decision==='rejected'&&comparison==='improved'&&passedTests)issues.push('rejection_conflicts_with_reported_success');
 if(decision==='deferred'&&value.integration)issues.push('deferred_report_cannot_be_integrated');
 if(value.integration){
  const completed=Date.parse(value.completedAt),integrated=Date.parse(value.integration.at);
  if(!Number.isFinite(completed)||!Number.isFinite(integrated)||integrated<completed)issues.push('integration_must_follow_completion');
  if(value.decision.outcome!=='accepted'||!passedTests||comparison!=='improved')issues.push('integration_requires_reported_acceptance_tests_and_improvement');
  if(!hash(value.integration.revision))issues.push('invalid_integration_revision');
 }
 return issues.length?{status:'inconsistent',claim:'untrusted',issues}:{...inspected,status:'consistent_report',claim:'reported'};
}
