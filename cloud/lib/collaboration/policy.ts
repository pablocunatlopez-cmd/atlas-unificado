import {publicUrl} from '../research/web.ts';
import {agentPlan,qualifiedScore,AGENT_EVAL_VERSION,type AgentEvaluation} from '../cloud/agents.ts';
import {livingReviewer} from '../evolution/living-policy.ts';
import {missionFor} from './missions.ts';
export const ICARUS_PROJECTS={atlas:'appgprj_6acdbbc1ce80819192cfb514a4cd474f',eras:'appgprj_6ad66800b1888191b0fc84e227cad74f'} as const;
export const ICARUS_ACQUIRE="UPDATE icarus_control SET content=?,lease_id=?,lease_until=? WHERE id='main' AND revision=? AND lease_until<? AND NOT EXISTS(SELECT 1 FROM icarus_consultations WHERE request_id=?) RETURNING revision";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,min:number,max:number)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
export type ConsultInput={requestId:string;actorId?:string;trigger?:'manual'|'schedule';targetProject?:'atlas'|'eras';problem?:string;sourceUrls?:string[]};
export function consultInput(raw:Record<string,unknown>):ConsultInput{
 if(!text(raw.requestId,1,120)||!String(raw.requestId).trim())throw Error('INPUT');
 if(raw.actorId!==undefined&&(typeof raw.actorId!=='string'||!missionFor(raw.actorId)))throw Error('INPUT');
 if(raw.problem!==undefined&&!text(raw.problem,5,600))throw Error('INPUT');
 if(raw.sourceUrls!==undefined&&(!Array.isArray(raw.sourceUrls)||!raw.sourceUrls.length||raw.sourceUrls.length>2||raw.sourceUrls.some(v=>typeof v!=='string')))throw Error('INPUT');
 let sourceUrls:string[]|undefined;try{if(Array.isArray(raw.sourceUrls))sourceUrls=raw.sourceUrls.map(v=>publicUrl(v));}catch{throw Error('INPUT');}
 if(raw.targetProject!==undefined&&raw.targetProject!=='atlas'&&raw.targetProject!=='eras')throw Error('INPUT');
 if(raw.trigger!==undefined&&raw.trigger!=='manual'&&raw.trigger!=='schedule')throw Error('INPUT');
 return{requestId:raw.requestId as string,...(raw.problem!==undefined?{problem:(raw.problem as string).trim()}:{}),...(sourceUrls?{sourceUrls}:{}),...(raw.targetProject!==undefined?{targetProject:raw.targetProject as 'atlas'|'eras'}:{}),...(raw.actorId!==undefined?{actorId:missionFor(raw.actorId as string)!.id}:{}),...(raw.trigger!==undefined?{trigger:raw.trigger as 'manual'|'schedule'}:{})};
}
export type ConsultationProposal={change:string;reason:string;validation:string[];sourceIds:string[]};
export function consultationProposal(raw:unknown,knownIds:readonly string[]):ConsultationProposal{
 if(!object(raw)||!text(raw.change,5,1000)||!text(raw.reason,5,800)||!Array.isArray(raw.validation)||!raw.validation.length||raw.validation.length>8||raw.validation.some(v=>!text(v,3,240))||!Array.isArray(raw.sourceIds)||!raw.sourceIds.length||raw.sourceIds.length>4||raw.sourceIds.some(v=>typeof v!=='string'||!knownIds.includes(v)))throw Error('PROPOSAL');
 return{change:(raw.change as string).trim(),reason:(raw.reason as string).trim(),validation:(raw.validation as string[]).map(v=>v.trim()),sourceIds:[...new Set(raw.sourceIds as string[])]};
}
export type ApplicationReceipt={project_id:string;commit_sha:string;version_id:string;summary:string;checks:{name:string;passed:true}[];reportedAt:string;verification:'reported-by-cloud-workflow'};
export function applicationReceipt(raw:unknown,target:'atlas'|'eras',at=new Date().toISOString()):ApplicationReceipt{
 if(!object(raw)||raw.project_id!==ICARUS_PROJECTS[target]||typeof raw.commit_sha!=='string'||!/^([a-f0-9]{40})$/i.test(raw.commit_sha)||!text(raw.version_id,1,240)||/\s/.test(raw.version_id as string)||!text(raw.summary,5,1400)||!Array.isArray(raw.checks)||!raw.checks.length||raw.checks.length>16||raw.checks.some(v=>!object(v)||!text(v.name,2,180)||v.passed!==true))throw Error('RECEIPT');
 return{project_id:raw.project_id as string,commit_sha:raw.commit_sha.toLowerCase(),version_id:raw.version_id as string,summary:(raw.summary as string).trim(),checks:(raw.checks as {name:string;passed:true}[]).map(c=>({name:c.name.trim(),passed:true})),reportedAt:at,verification:'reported-by-cloud-workflow'};
}
export function recordInput(raw:Record<string,unknown>){if(typeof raw.consultationId!=='string'||!/^icarus-[1-9]\d{0,9}$/.test(raw.consultationId)||Number(raw.consultationId.slice(7))>1e9)throw Error('INPUT');if(!object(raw.receipt))throw Error('RECEIPT');return{consultationId:raw.consultationId,receipt:raw.receipt};}
export function consultationModels(evaluations:AgentEvaluation[]){
 const valid=evaluations.filter(e=>e.version===AGENT_EVAL_VERSION&&e.status==='qualified'&&e.score&&qualifiedScore(e.score)&&e.score.cases.filter(c=>c.domain==='evidence'&&c.passed).length===2);
 const creator=agentPlan('Investiga fuentes y evidencia para una propuesta aplicada',valid).primary;if(!valid.some(e=>e.model===creator))return null;const reviewer=livingReviewer(creator,valid);return reviewer?{creator,reviewer}:null;
}

export function consultationReview(raw:unknown){if(!object(raw)||!['accept','reject'].includes(String(raw.decision))||typeof raw.decision!=='string'||!text(raw.reason,1,4000))throw Error('REVIEW');return{decision:raw.decision as 'accept'|'reject',reason:(raw.reason as string).trim().slice(0,500)};}
