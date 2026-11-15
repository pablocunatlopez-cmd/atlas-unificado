import {agentPlan,qualifiedScore,AGENT_EVAL_VERSION,type AgentEvaluation} from '../cloud/agents.ts';
import {ROOM_IDS} from '../../public/house/layout.js';
export const LIVING_ACQUIRE="UPDATE living_world SET content=?,lease_id=?,lease_until=? WHERE id='main' AND revision=? AND lease_until<? AND NOT EXISTS(SELECT 1 FROM living_builds WHERE request_id=?) RETURNING revision";
export function livingReviewer(creator:string,evaluations:AgentEvaluation[]){
 const candidates=evaluations.filter(e=>e.model!==creator&&e.status==='qualified'&&e.version===AGENT_EVAL_VERSION&&e.score&&qualifiedScore(e.score)&&e.score.cases.filter(c=>c.domain==='programming'&&c.passed).length===2);
 const candidate=agentPlan('Implementa código de escena y revisa contratos',candidates).primary;
 return candidate!==creator&&candidates.some(e=>e.model===candidate)?candidate:undefined;
}
export function livingBuildInput(raw:Record<string,unknown>){
 if(typeof raw.requestId!=='string'||!raw.requestId.trim()||raw.requestId.length>120)throw Error('INPUT');
 if(raw.scope!==undefined&&raw.scope!=='house'&&raw.scope!=='room')throw Error('INPUT');
 if(raw.room!==undefined&&(typeof raw.room!=='string'||!ROOM_IDS.includes(raw.room)))throw Error('INPUT');
 if(raw.trigger!==undefined&&raw.trigger!=='manual'&&raw.trigger!=='schedule')throw Error('INPUT');
 if(raw.mode!==undefined&&(typeof raw.mode!=='string'||!['auto','experiment','design-kit'].includes(raw.mode)))throw Error('INPUT');
 if(raw.style!==undefined&&(typeof raw.style!=='string'||!['gallery','observatory','garden','arcade'].includes(raw.style)))throw Error('INPUT');
 return{...(raw.mode!==undefined?{mode:raw.mode as 'auto'|'experiment'|'design-kit'}:{}),...(raw.style!==undefined?{style:raw.style as 'gallery'|'observatory'|'garden'|'arcade'}:{}),requestId:raw.requestId,room:raw.room as string|undefined,scope:(raw.scope||'room') as 'house'|'room',trigger:raw.trigger as 'manual'|'schedule'|undefined};
}
