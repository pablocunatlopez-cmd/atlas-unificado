import {MISSIONS,type MissionKind} from '../collaboration/missions.ts';
import type {Capability,Trial} from './benchmarks.ts';
import type {ResearchRun} from '../research/types.ts';
import {personalities} from '../../public/house/personalities.js';
export type WorldEntity={id:string;kind:MissionKind;name:string;room:string;module:Capability;role:string;personality:string;visualOnly:boolean};
export const WORLD_ENTITIES:WorldEntity[]=MISSIONS.map(m=>({id:m.id,kind:m.kind,name:m.name,room:m.kind==='module'?'atlas':m.room,module:m.capability,role:m.title,personality:personalities[m.residentId]&&m.kind==='resident'?personalities[m.residentId]:m.application+' '+m.runtime,visualOnly:false}));
export type EntityCreation={origin?:'model'|'tool-experiment'|'design-kit';measurement?:{metric:string;before:number;after:number};attempts:number;applied:number;lastBuildId:string;lastRunId:string;artifactIds:string[];title:string;goal:string;review?:string;at:string};
export type EntityMemory={work?:{id:string;title:string;summary:string;status:string;domain:string;artifactId?:string;consultationId?:string;at:string};programming?:{attempts:number;installed:number;promotions:number;lastRunId:string;lastTrialId:string;taskId:string;artifactId?:string;decision:string;at:string};consultation?:{id:string;domain:string;question:string;status:string;sourceIds:string[];modelSteps:number;at:string;lastRunId:string;receipt?:{project_id:string;commit_sha:string;version_id:string;summary:string}};creation?:EntityCreation;grounding?:'source-linked'|'unverified';turns:number;reflections:number;adjustments:number;lastRunId:string|null;question:string;conclusion:string;uncertainties:string[];sourceIds:string[];updatedAt:string|null};
export type WorldState={schema:1;memories:Record<string,EntityMemory>;cursors:Record<Capability,number>};
const emptyMemory=(e:WorldEntity):EntityMemory=>({turns:0,reflections:0,adjustments:0,lastRunId:null,question:`¿Qué necesita mejorar ${e.name} en su función: ${e.role}?`,conclusion:'',uncertainties:[],sourceIds:[],updatedAt:null});
export const initialWorld=():WorldState=>({schema:1,memories:Object.fromEntries(WORLD_ENTITIES.map(e=>[e.id,emptyMemory(e)])),cursors:{graphics:0,programming:0,audio:0,perception:0}});
export function expandWorld(previous:WorldState):WorldState{const world=structuredClone(previous);for(const e of WORLD_ENTITIES)world.memories[e.id]??=emptyMemory(e);return world;}
export function selectWorldActor(world:WorldState,module:Capability){const members=WORLD_ENTITIES.filter(e=>e.kind==='resident'&&e.module===module);return members[world.cursors[module]%members.length];}
export function worldPerspective(world:WorldState,actor:WorldEntity){const memory=world.memories[actor.id];return{id:actor.id,name:actor.name,role:actor.role,personality:actor.personality,room:actor.room,module:actor.module,question:memory?.question,previousConclusion:memory?.grounding==='source-linked'?memory.conclusion.slice(0,600):undefined};}
export function advanceWorld(previous:WorldState,actor:WorldEntity,run:ResearchRun,trial:Trial){
 const world=expandWorld(previous),reflection=run.deliberation?.status==='completed'?run.deliberation.reflection:undefined;
 const ids=new Set([actor.id,'room:'+actor.room,'module:'+actor.module]);
 for(const id of ids){const memory=world.memories[id];if(!memory)continue;memory.turns++;memory.reflections+=reflection?1:0;memory.adjustments+=id.startsWith('module:')&&trial.decision==='promoted'?1:0;memory.lastRunId=run.id;memory.updatedAt=run.date;memory.sourceIds=run.sourceIds;
  if(reflection){memory.grounding=reflection.grounding||'unverified';memory.question=reflection.nextQuestion;memory.conclusion=reflection.conclusion;memory.uncertainties=reflection.uncertainties;}
 }
 world.cursors[actor.module]++;
 return{world,receipt:{actorId:actor.id,roomId:'room:'+actor.room,moduleId:'module:'+actor.module,parentRunId:previous.memories[actor.id]?.lastRunId||null,status:reflection?'reflected' as const:'waiting' as const}};
}

// Creation memory records authored artifacts separately from factual conclusions,
// source provenance, benchmark adjustments and model weights.
export function rememberWorldCreation(previous:WorldState,creation:NonNullable<ResearchRun['creation']>,runId:string){
 const world=expandWorld(previous),actor=WORLD_ENTITIES.find(e=>e.id===creation.actorId);if(!actor)return world;
 for(const id of new Set([actor.id,'room:'+actor.room,'module:'+actor.module])){
  const memory=world.memories[id];if(!memory||memory.creation?.lastBuildId===creation.id)continue;
  memory.turns++;memory.updatedAt=creation.at;const before=memory.creation;
  memory.creation={origin:creation.origin||'model',...(creation.experiment?{measurement:{metric:creation.experiment.metric,before:creation.experiment.before,after:creation.experiment.after}}:{}),attempts:(before?.attempts||0)+1,applied:(before?.applied||0)+(creation.status==='applied'?1:0),lastBuildId:creation.id,lastRunId:runId,artifactIds:creation.artifactIds.slice(),title:creation.title,goal:creation.goal,review:creation.review,at:creation.at};
 }
 return world;
}

export function rememberWorldConsultation(previous:WorldState,c:NonNullable<ResearchRun['consultation']>,runId:string){
 const world=expandWorld(previous),actor=WORLD_ENTITIES.find(e=>e.id===c.actorId);if(!actor)return world;
 for(const id of new Set([actor.id,'room:'+actor.room,'module:'+actor.module])){const m=world.memories[id];if(!m||m.consultation?.id===c.id&&m.consultation.status===c.status)continue;m.turns++;m.lastRunId=runId;m.updatedAt=c.completedAt||c.at;m.question=c.question;m.consultation={id:c.id,domain:c.domain,question:c.question,status:c.status,sourceIds:c.sources.map(s=>s.id),modelSteps:c.agents.filter(a=>a.status==='completed').length,at:c.completedAt||c.at,lastRunId:runId,...(c.receipt?{receipt:{project_id:c.receipt.project_id,commit_sha:c.receipt.commit_sha,version_id:c.receipt.version_id,summary:c.receipt.summary}}:{})};}return world;
}

export function rememberWorldProgram(previous:WorldState,trial:NonNullable<ResearchRun['programmingTrial']>,runId:string){
 const world=expandWorld(previous),actor=WORLD_ENTITIES.find(e=>e.id===trial.actorId);if(!actor)return world;
 for(const id of new Set([actor.id,'room:'+actor.room,'module:'+actor.module])){
  const memory=world.memories[id];if(!memory||memory.programming?.lastTrialId===trial.id)continue;
  const old=memory.programming;memory.turns++;memory.updatedAt=trial.at;
  memory.programming={attempts:(old?.attempts||0)+1,installed:(old?.installed||0)+(trial.decision==='installed'?1:0),promotions:(old?.promotions||0)+(trial.decision==='promoted'?1:0),lastRunId:runId,lastTrialId:trial.id,taskId:trial.taskId,artifactId:trial.artifactId,decision:trial.decision,at:trial.at};
 }return world;
}

export function rememberWorldWork(previous:WorldState,work:{id:string;actorId:string;title:string;summary:string;status:string;domain:string;artifactId?:string;consultationId?:string;at:string}){
 const world=expandWorld(previous),actor=WORLD_ENTITIES.find(e=>e.id===work.actorId);if(!actor)return world;
 for(const id of new Set([actor.id,'room:'+actor.room,'module:'+actor.module])){const m=world.memories[id];if(!m||m.work?.id===work.id||m.work&&Date.parse(m.work.at)>Date.parse(work.at))continue;m.turns++;m.lastRunId=work.id;m.updatedAt=work.at;m.work={id:work.id,title:work.title.slice(0,200),summary:work.summary.slice(0,1000),status:work.status,domain:work.domain,artifactId:work.artifactId,consultationId:work.consultationId,at:work.at};}
 return world;
}
