import {comparePairedRuns} from './paired-model-evaluation.mjs';

/**
 * Compare multiple measured candidates against one fixed baseline.
 * This function never deploys models or accepts model-generated verdicts.
 */
export function rankModelCandidates(baselineRuns,candidates,options={}){
  if(!Array.isArray(candidates)||candidates.length===0)throw Error('Candidates required');
  const seen=new Set();
  const results=candidates.map(item=>{
    if(!item||typeof item.name!=='string'||!item.name.trim()||seen.has(item.name))throw Error('Missing or duplicate candidate name');
    seen.add(item.name);
    const verdict=comparePairedRuns(baselineRuns,item.runs,options);
    return {name:item.name,...verdict};
  });
  results.sort((a,b)=>
    Number(b.accepted)-Number(a.accepted)||
    b.candidate.passed-a.candidate.passed||
    a.regressions.length-b.regressions.length||
    a.candidate.latencyP95Ms-b.candidate.latencyP95Ms||
    (a.candidate.ttftP95Ms??Infinity)-(b.candidate.ttftP95Ms??Infinity)||
    a.name.localeCompare(b.name)
  );
  return {recommended:results.find(result=>result.accepted)?.name??null,results};
}
