import {infer,CLOUD_MODEL} from '../cloud/inference';
import {coachingCases,gradeCoaching,compareCoaching,weakestDomain,STRATEGIES,COACH_VERSION,COACH_SCOPE,type Strategy,type CoachState,type CoachTrial} from './coaching';
export async function runCoaching(previous:CoachState|undefined,at=Date.now()):Promise<{state:CoachState;trial:CoachTrial}>{
 const baseline=previous?.strategy||'baseline',attempts=(previous?.attempts||0)+1;
 const candidates=(['verify','constraints','evidence'] as Strategy[]).filter(s=>s!==baseline),candidate=candidates[(attempts-1)%candidates.length];
 const date=new Date(at).toISOString(),cases=coachingCases(Math.floor(at/86400000)+attempts);
 const trial:CoachTrial={version:COACH_VERSION,at:date,model:CLOUD_MODEL,status:'unavailable',decision:'waiting',baseline,candidate,reason:'Evaluación pendiente.',scope:COACH_SCOPE};
 try{
  const request=JSON.stringify({task:'Resuelve los ejercicios. Devuelve JSON {answers:[{id,value}]} con un valor de texto por ejercicio. Respeta exactamente el formato solicitado; no incluyas explicaciones.',cases:cases.map(({id,question})=>({id,question}))});
  const assess=async(strategy:Strategy)=>gradeCoaching(cases,await infer([{role:'system',content:'Responde con precisión y reconoce datos ausentes. '+STRATEGIES[strategy]},{role:'user',content:request}],true,650,0,'coaching'));
  trial.before=await assess(baseline);trial.after=await assess(candidate);
  const result=compareCoaching(trial.before,trial.after);trial.status='completed';trial.decision=result.promoted?'promoted':'retained';
  trial.reason=result.promoted?'Mejora en desarrollo y en los casos reservados sin perder ningún acierto previo. Se conserva el perfil anterior para poder restaurarlo.':result.regression?'La propuesta pierde un acierto previo; se conserva la estrategia actual.':'No demuestra mejora simultánea en desarrollo y casos reservados; se conserva la estrategia actual.';
  const active=result.promoted?trial.after:trial.before;
  return{state:{strategy:result.promoted?candidate:baseline,attempts,lastAttemptAt:date,nextAttemptAt:new Date(at+8*3600000).toISOString(),weakest:active.passed<active.total?weakestDomain(active):undefined,lastTrial:trial},trial};
 }catch(error){
  trial.reason=error instanceof Error?error.message:'Inferencia indisponible. No se cuenta mejora.';
  return{state:{strategy:baseline,attempts:previous?.attempts||0,lastAttemptAt:date,nextAttemptAt:new Date(at+3600000).toISOString(),weakest:previous?.weakest,lastTrial:trial},trial};
 }
}
