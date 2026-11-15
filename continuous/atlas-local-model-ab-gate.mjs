import {evaluateAtlasLocalModel} from './atlas-local-model-evaluator.mjs';
/**
 * Sequential, paired A/B evaluation. No model modification, automatic promotion,
 * network access or deployment. The caller injects both inference functions.
 */
export async function compareAtlasLocalModels({
 baselineInfer,candidateInfer,cases,clock,readMemory,
 minQualityGain=0,maxLatencyRegressionRatio=1.25
}={}){
 if(typeof baselineInfer!=='function'||typeof candidateInfer!=='function'||
  !Number.isFinite(minQualityGain)||minQualityGain<0||minQualityGain>1||
  !Number.isFinite(maxLatencyRegressionRatio)||
  maxLatencyRegressionRatio<1||maxLatencyRegressionRatio>10)
  throw Error('Invalid comparison configuration');
 const options={cases,...(clock?{clock}:{}),
  ...(readMemory?{readMemory}:{})};
 const baseline=await evaluateAtlasLocalModel({...options,infer:baselineInfer});
 const candidate=await evaluateAtlasLocalModel({...options,infer:candidateInfer});
 const avg=report=>report.cases.reduce((sum,x)=>sum+x.elapsedMs,0)/report.total;
 const baselineLatencyMs=avg(baseline),candidateLatencyMs=avg(candidate);
 const qualityDelta=candidate.exactMatchRate-baseline.exactMatchRate;
 const newFailures=baseline.cases.filter((item,index)=>
  item.passed&&!candidate.cases[index].passed).map(x=>x.id);
 const latencyWithinLimit=baselineLatencyMs===0?
  candidateLatencyMs===0:candidateLatencyMs<=baselineLatencyMs*maxLatencyRegressionRatio;
 const qualityImproved=qualityDelta>=minQualityGain;
 const recommend=qualityImproved&&newFailures.length===0&&
  latencyWithinLimit&&candidate.cases.every(x=>x.status==='completed');
 return Object.freeze({
  status:'completed',recommendation:recommend?'eligible_for_human_review':'reject_candidate',
  baseline,candidate,qualityDelta,baselineLatencyMs,candidateLatencyMs,
  newFailures:Object.freeze(newFailures),latencyWithinLimit,
  criteria:Object.freeze({minQualityGain,maxLatencyRegressionRatio}),
  automaticPromotion:false,modelIdentityVerified:false,
  note:'Exact-match tests only; manual review required before any adoption'
 });
}
