/**
 * Provider-neutral offline evaluation gate for Atlas model candidates.
 * Metrics must come from recorded executions, not from model self-reports.
 * Inspired by reproducible inference benchmarks and explicit agent gates.
 */
export function summarizeRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) throw Error('At least one recorded run is required');
  const ids=new Set(),durations=[],ttfts=[];let passed=0,failed=0;
  for(const run of runs){
    if(!run || typeof run.id!=='string' || !run.id.trim() || ids.has(run.id))throw Error('Missing or duplicate run id');
    ids.add(run.id);
    if(typeof run.passed!=='boolean')throw Error('Run must have an externally verified boolean passed');
    if(!Number.isFinite(run.durationMs)||run.durationMs<0)throw Error('Invalid durationMs');
    if(run.ttftMs!==null && run.ttftMs!==undefined && (!Number.isFinite(run.ttftMs)||run.ttftMs<0||run.ttftMs>run.durationMs))throw Error('Invalid ttftMs');
    if(run.passed)passed++;else failed++;
    durations.push(run.durationMs);if(run.ttftMs!==null&&run.ttftMs!==undefined)ttfts.push(run.ttftMs);
  }
  const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.ceil(p*sorted.length)-1];};
  return {total:runs.length,passed,failed,passRate:passed/runs.length,
    latencyP50Ms:percentile(durations,.5),latencyP95Ms:percentile(durations,.95),
    ttftP95Ms:ttfts.length===runs.length?percentile(ttfts,.95):null};
}

export function evaluateCandidate(baseline,candidate,{minPassRate=0.9,maxLatencyRegression=0.15}={}){
  for(const data of [baseline,candidate]){
    if(!data||!Number.isSafeInteger(data.total)||data.total<1||
      !Number.isSafeInteger(data.passed)||data.passed<0||data.passed>data.total||
      !Number.isFinite(data.passRate)||Math.abs(data.passRate-data.passed/data.total)>1e-9||
      !Number.isFinite(data.latencyP95Ms)||data.latencyP95Ms<0||
      (data.ttftP95Ms!==null&&(!Number.isFinite(data.ttftP95Ms)||data.ttftP95Ms<0)))throw Error('Invalid recorded summary');
  }
  if(baseline.total!==candidate.total)throw Error('Benchmark sample sizes differ');
  if(!Number.isFinite(minPassRate)||minPassRate<0||minPassRate>1||
     !Number.isFinite(maxLatencyRegression)||maxLatencyRegression<0)throw Error('Invalid thresholds');
  const reasons=[];
  if(candidate.passRate<minPassRate)reasons.push('candidate_below_quality_floor');
  if(candidate.passed<baseline.passed)reasons.push('candidate_quality_regression');
  if(candidate.latencyP95Ms>baseline.latencyP95Ms*(1+maxLatencyRegression))reasons.push('latency_regression');
  if(baseline.ttftP95Ms!==null&&candidate.ttftP95Ms!==null&&candidate.ttftP95Ms>baseline.ttftP95Ms*(1+maxLatencyRegression))reasons.push('first_token_regression');
  return {accepted:reasons.length===0,reasons,baseline,candidate};
}
