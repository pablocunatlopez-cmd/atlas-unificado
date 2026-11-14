import {LEARNING_CATALOG} from './learning-status.mjs';
import {sanitizeCreativePreview} from './creative-preview.mjs';
import {sanitizeIcarusStatus} from './icarus-status.mjs';
const phases=new Set(['mind','ion','constellation','logic','retain','waiting']);
const kinds=new Set(['curriculum-repair','tool-experiment','creative-experiment','open-inquiry']);
const focuses=new Set(['programming','language','3d','games','video','music','conversation','research','reasoning','suceso','unknown']);
const epistemic=new Set(['within-model','unexpected','unexplained','unassessed']);
const reasons=new Set(['completed','no_new_evidence','no_eligible_goal','cancelled','callback_failed','cooldown','busy','interrupted','disabled']);
const count=value=>Number.isSafeInteger(value)&&value>=0?Math.min(value,1000000000):0;
const date=value=>typeof value==='string'&&value.length<=35&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const id=value=>typeof value==='string'&&Object.hasOwn(LEARNING_CATALOG,value)?value:null;
/** Public state only. Hypotheses, predictions and unexplained observations
 * stay in the PC journal; public labels are rebuilt from the fixed catalogue.
 */
export function sanitizeExperienceStatus(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const enabled=value.enabled===true,paused=value.paused===true,phase=value.phase==='retained'?'retain':phases.has(value.phase)?value.phase:'waiting';
 const raw=value.objective,kind=kinds.has(raw?.kind)?raw.kind:null,taskId=id(raw?.taskId),focus=focuses.has(raw?.focus)?raw.focus:taskId==='lor-omega-schema'?'language':'programming';
 const objective=kind==='open-inquiry'?{question:focus==='suceso'?'Observar límites del entendimiento':'Explorar un suceso no explicado',kind,focus,taskId:null,revision:count(raw.revision||raw.objectiveRevision)}:kind==='creative-experiment'&&['3d','games'].includes(focus)?{question:focus==='3d'?'Explorar una mejora 3D':'Explorar una mejora de videojuegos',kind,focus,taskId:null,revision:count(raw.revision||raw.objectiveRevision)}:kind&&taskId?{question:LEARNING_CATALOG[taskId].name,kind,focus,taskId,revision:count(raw.revision||raw.objectiveRevision)}:null;
 const last=value.last?{at:date(value.last.at),taskId:id(value.last.taskId),focus:focuses.has(value.last.focus)?value.last.focus:value.last.taskId==='lor-omega-schema'?'language':'programming',executed:value.last.executed===true,cases:Math.min(128,count(value.last.cases)),passed:Math.min(128,count(value.last.cases),count(value.last.passed)),acceptedChange:value.last.acceptedChange===true,reason:reasons.has(value.last.reason)?value.last.reason:'callback_failed',epistemicStatus:epistemic.has(value.last.epistemicStatus)?value.last.epistemicStatus:'unassessed',unknownsCount:Math.min(4,count(value.last.unknownsCount)),noveltyScope:value.last.noveltyScope==='new-to-atlas'?'new-to-atlas':'unresolved'}:null;
 return {enabled,paused,running:enabled&&!paused&&value.running===true&&phase!=='waiting',phase,objective,last,experiences:count(value.experiences),learningChanges:Math.min(count(value.experiences),count(value.learningChanges)),nextRun:enabled?date(value.nextRun):null,creative:sanitizeCreativePreview(value.creative),icarus:sanitizeIcarusStatus(value.icarus)};
}
