import {MISSIONS,MISSION_ROTATION,type Mission} from './missions.ts';
export const HOUSE_WORK_INTERVAL=10000;
export const HOUSE_RESEARCH_INTERVAL=120000;
export const HOUSE_LEASE=180000;
const residents=MISSIONS.filter(m=>m.kind==='resident'),systems=MISSION_ROTATION.filter(m=>m.kind!=='resident');
// Two physical specialists and one system per pulse: all 24 inhabitants receive
// a turn in twelve pulses, while rooms and non-visible systems keep their work.
export function houseMission(cursor:number):Mission{if(!Number.isSafeInteger(cursor)||cursor<0)throw Error('INPUT');const group=Math.floor(cursor/3),slot=cursor%3;return slot===2?systems[group%systems.length]:residents[(group*2+slot)%residents.length];}
export const HOUSE_ACQUIRE="UPDATE house_work SET content=?,revision=revision+1,lease_id=?,lease_until=? WHERE id='main' AND revision=? AND lease_until<=? AND json_extract(content,'$.enabled')=1 AND coalesce(json_extract(content,'$.nextStepMs'),0)<=? AND NOT EXISTS(SELECT 1 FROM house_work_runs WHERE request_id=?) RETURNING revision";
export type WorkStatus='applied'|'tested'|'unchanged'|'waiting'|'rejected';
export type WorkVisualEvent={id:string;workerId:string;messengerId:'language-symbol';recipientIds:string[];status:WorkStatus;at:string;startedAt:string;sourceCount:number;artifactCount:number;modelSteps:number;operation:'research'|'tool'|'program'|'engineering'};
export function visualWork(work:{id:string;residentId:string;status:WorkStatus;at:string;startedAt:string;sourceCount:number;modelSteps:number;artifactId?:string;operation:WorkVisualEvent['operation']}):WorkVisualEvent{return{id:work.id,workerId:work.residentId,messengerId:'language-symbol',recipientIds:[work.residentId],status:work.status,at:work.at,startedAt:work.startedAt,sourceCount:Math.min(2,work.sourceCount),artifactCount:work.artifactId?1:0,modelSteps:Math.min(2,work.modelSteps),operation:work.sourceCount+work.modelSteps>0?'research':work.operation};}
export function houseRequest(raw:Record<string,unknown>){if(!['step','pause','resume','record-engineering','rollback','visibility'].includes(String(raw.action)))throw Error('INPUT');if(raw.action==='step'&&(typeof raw.requestId!=='string'||!raw.requestId.trim()||raw.requestId.length>120||/[\u0000-\u001f]/.test(raw.requestId)))throw Error('INPUT');return{action:raw.action as 'step'|'pause'|'resume'|'record-engineering'|'rollback'|'visibility',requestId:raw.requestId as string};}
