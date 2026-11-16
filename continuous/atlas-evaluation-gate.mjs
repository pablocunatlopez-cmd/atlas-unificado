/**
 * Deterministic, review-only evaluation gate inspired by durable agent workflows.
 * Never promotes code, downloads models or grants tool permissions.
 */
const METRICS=['recallAt5','ndcgAt5','citationAccuracy','latencyP95Ms','memoryMb'];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function evaluateAtlasCandidate(baseline,candidate,{minimumQueries=100,maxLatencyRegression=1.15,maxMemoryRegression=1.2}={}){
 if(!Number.isInteger(minimumQueries)||minimumQueries<1||!finite(maxLatencyRegression)||maxLatencyRegression<1||!finite(maxMemoryRegression)||maxMemoryRegression<1){
  return Object.freeze({verdict:'insufficient-evidence',reasons:['Los umbrales de evaluación no son válidos.'],promote:false});
 }
 if(!baseline||!candidate||!Number.isInteger(candidate.queries)||candidate.queries<minimumQueries||
  !Number.isInteger(baseline.queries)||baseline.queries<minimumQueries||
  METRICS.some(key=>!finite(baseline[key])||!finite(candidate[key]))){
  return Object.freeze({verdict:'insufficient-evidence',reasons:['Se requieren métricas finitas y un corpus evaluado suficientemente amplio.'],promote:false});
 }
 const reasons=[];
 if(candidate.queries!==baseline.queries)reasons.push('Los tamaños de corpus difieren; se requiere evaluación emparejada');
 for(const key of ['recallAt5','ndcgAt5','citationAccuracy']){
  if(baseline[key]<0||baseline[key]>1||candidate[key]<0||candidate[key]>1)reasons.push(key+': rango inválido');
  else if(candidate[key]+1e-9<baseline[key])reasons.push(key+': regresión de calidad');
 }
 for(const key of ['latencyP95Ms','memoryMb'])if(baseline[key]<=0||candidate[key]<=0)reasons.push(key+': valor inválido');
 if(candidate.latencyP95Ms>baseline.latencyP95Ms*maxLatencyRegression)reasons.push('latencia p95 excesiva');
 if(candidate.memoryMb>baseline.memoryMb*maxMemoryRegression)reasons.push('memoria excesiva');
 return Object.freeze({verdict:reasons.length?'reject':'review-required',reasons,promote:false});
}
export function atlasReviewPlan({id,goal,capabilities=[]}={}){
 if(typeof id!=='string'||!id.trim()||typeof goal!=='string'||!goal.trim()||!Array.isArray(capabilities))throw new TypeError('Invalid review plan');
 return Object.freeze({id:id.slice(0,100),goal:goal.slice(0,500),steps:Object.freeze([
 {vertex:'mental',action:'Formular hipótesis y predicción',requiresApproval:false},
 {vertex:'physical',action:'Comprobar evidencias con herramientas autorizadas',requiresApproval:true},
 {vertex:'god',action:'Registrar sorpresa o contradicción sin borrar la observación',requiresApproval:false},
 {vertex:'mental',action:'Evaluar A/B, revisar la hipótesis y solicitar aprobación',requiresApproval:true}
 ]),availableCapabilities:Object.freeze(capabilities.filter(x=>typeof x==='string').slice(0,20)),execution:'not-started',autoPromote:false});
}
