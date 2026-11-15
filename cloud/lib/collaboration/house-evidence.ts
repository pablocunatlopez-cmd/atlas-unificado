import {inspectEvidenceResult} from '../../continuous/process-evidence.mjs';
import {reviewEvidenceReport} from '../../continuous/process-evidence-review.mjs';

export const HOUSE_EVIDENCE_VERSION='house-evidence-1';
export const HOUSE_EVIDENCE_UPSTREAM={repository:'pablocunatlopez-cmd/atlas-unificado',commit:'069e38b9ad890f3ef58ee4f0689917372a1367e1',files:['continuous/process-evidence.mjs','continuous/process-evidence-review.mjs']} as const;
// SHA-256 of the explicit descriptor {"version":1,"baseline":"absent"}.
// It identifies absence, never an invented previous implementation or score.
export const ABSENT_BASELINE_REVISION='cc5407b557e643874c37f26af2eb572232630ec9326edec32a86621ce5dbbd5b';
type Measurement={metric:string;before:number;after:number;direction:'lower'|'higher'};
export type HouseEvidenceInput={taskId:string;processId:string;artifactId:string;candidateRevision:string;baselineRevision?:string;completedAt:string;checks:readonly {name:string;passed:boolean}[];measurement?:Measurement;testVersion?:string};
type Comparison='improved'|'unchanged'|'regressed'|'incomparable';
const id=(v:unknown)=>typeof v==='string'&&/^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(v);
const digest=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const bounded=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validateHouseWorkEvidence(input:HouseEvidenceInput,{now=Date.now()}={}){
 const checksValid=Array.isArray(input.checks)&&input.checks.length>0&&input.checks.length<=32&&input.checks.every(c=>!!c&&bounded(c.name,240)&&typeof c.passed==='boolean');
 const passed=checksValid&&input.checks.every(c=>c.passed);
 const baselinePresent=input.baselineRevision!==undefined;
 const revisionValid=digest(input.candidateRevision)&&(!baselinePresent||digest(input.baselineRevision));
 const version=input.testVersion||HOUSE_EVIDENCE_VERSION;
 let outcome:Comparison=baselinePresent&&input.baselineRevision?.toLowerCase()===input.candidateRevision.toLowerCase()?'unchanged':'incomparable';
 let reason=baselinePresent?'Contenido candidato diferente; no hay una medida que demuestre mejora.':'Primera instalación o borrador: no existe una implementación anterior comparable.';
 const m=input.measurement;
 const measurementValid=!!m&&bounded(m.metric,160)&&Number.isFinite(m.before)&&Number.isFinite(m.after)&&['lower','higher'].includes(m.direction);
 if(m&&measurementValid&&baselinePresent&&input.baselineRevision?.toLowerCase()!==input.candidateRevision.toLowerCase()){const delta=m.direction==='lower'?m.before-m.after:m.after-m.before;outcome=delta>0?'improved':delta<0?'regressed':'unchanged';reason=`${m.metric}: ${m.before} → ${m.after}; ${m.direction==='lower'?'menor':'mayor'} es mejor.`.slice(0,240);}
 // A changed digest alone does not justify a better-quality claim. Missing or
 // malformed measurements likewise cannot authorize a measured promotion.
 const decision=!passed?'rejected':outcome==='improved'?'accepted':'deferred';
 const report={version:1,taskId:input.taskId,processId:input.processId,artifactId:input.artifactId,artifactRevision:input.candidateRevision,completedAt:input.completedAt,tests:checksValid?input.checks.map((c,index)=>({id:'check-'+index,version,outcome:c.passed?'passed':'failed',name:c.name})):[],comparison:{baselineRevision:input.baselineRevision||ABSENT_BASELINE_REVISION,candidateRevision:input.candidateRevision,outcome,reason},decision:{outcome:decision,reason:!passed?'Hay pruebas ausentes, inválidas o fallidas.':decision==='accepted'?'Las pruebas declaradas pasan y la medida declarada mejora frente a la base.':'Resultado utilizable como borrador o prueba; no se acredita una mejora comparativa.'}};
 const inspected=inspectEvidenceResult(report,{now}),review=reviewEvidenceReport(report,{now});
 const contractValid=revisionValid&&id(input.taskId)&&id(input.processId)&&id(input.artifactId)&&bounded(version,64)&&(!m||measurementValid);
 const consistent=contractValid&&review.status==='consistent_report';
 return{version:HOUSE_EVIDENCE_VERSION,report,inspection:inspected,review,claim:'reported' as const,canRecordArtifact:consistent&&passed,reportedImprovement:consistent&&passed&&outcome==='improved',baselinePresent,source:HOUSE_EVIDENCE_UPSTREAM,note:'Informe del ejecutor. La validación comprueba forma y coherencia; no autentica al productor, no ejecuta pruebas y no constituye verificación independiente ni integración en Lía.'};
}
