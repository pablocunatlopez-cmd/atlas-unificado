import {summarizeRuns,evaluateCandidate} from './model-evaluation-gate.mjs';

/**
 * Compare matched task executions, not unrelated samples.
 * Passed must be populated by an independent verifier.
 * This is a recommendation gate, not an automatic deployment permission.
 */
export function comparePairedRuns(baselineRuns,candidateRuns,options={}){
  const baseline=summarizeRuns(baselineRuns);
  const candidate=summarizeRuns(candidateRuns);
  const baselineById=new Map(baselineRuns.map(run=>[run.id,run]));
  const candidateById=new Map(candidateRuns.map(run=>[run.id,run]));
  if(baselineById.size!==candidateById.size||
    [...baselineById.keys()].some(id=>!candidateById.has(id)))
    throw Error('Baseline and candidate must use identical task IDs');
  const regressions=[],improvements=[];
  for(const [id,previous] of baselineById){
    const next=candidateById.get(id);
    if(previous.passed&&!next.passed)regressions.push(id);
    if(!previous.passed&&next.passed)improvements.push(id);
  }
  const aggregate=evaluateCandidate(baseline,candidate,options);
  const reasons=[...aggregate.reasons];
  if(regressions.length)reasons.push('individual_task_regression');
  return {
    accepted:reasons.length===0,
    reasons,
    regressions:regressions.sort(),
    improvements:improvements.sort(),
    baseline,
    candidate,
  };
}
