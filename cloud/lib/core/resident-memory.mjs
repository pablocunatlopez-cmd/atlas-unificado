import {WORKSTATIONS} from '../../public/house/residents.js';
import {PHASE_LABELS,STATE_LABELS,TELEMETRY_FRESH_MS,telemetryAge} from '../../public/house/process-state.js';

// The coordinator reports outcomes; the house records only what it can attribute
// to a real station and a fresh signal. This is observation, not learning.
export const RESIDENT_MEMORY_WINDOW_MS=30*60*1000;
export const RESIDENT_MEMORY_RETENTION_MS=30*24*60*60*1000;
export const RESIDENT_MEMORY_LIMIT=20;
const MAX_EVENTS=12;
const TERMINAL=new Set(['passed','failed']);
const RESIDENT_IDS=new Set(WORKSTATIONS.map(resident=>resident.id));
const safeText=value=>value.replace(/\s+/g,' ').trim().slice(0,64);

export function isResidentId(value){
 return typeof value==='string'&&RESIDENT_IDS.has(value);
}

export function residentMemoryEventKey({residentId,processId,state,phase},at=Date.now(),windowMs=RESIDENT_MEMORY_WINDOW_MS){
 return [residentId,processId,state,phase||'none',Math.floor(at/windowMs)].join(':');
}

export function buildResidentMemoryEvents(telemetry,{now=Date.now(),windowMs=RESIDENT_MEMORY_WINDOW_MS}={}){
 const age=telemetryAge(telemetry?.at,{now});
 if(!telemetry||telemetry.connected===false||age===null||age>TELEMETRY_FRESH_MS)return [];
 const processes=new Map();
 for(const process of Array.isArray(telemetry.processes)?telemetry.processes:[]){
  if(process&&typeof process.id==='string')processes.set(process.id,process);
 }
 const at=new Date(telemetry.at).toISOString(),events=[];
 for(const resident of WORKSTATIONS){
  if(!resident.processIds?.length)continue;
  for(const processId of resident.processIds){
   const process=processes.get(processId);
   if(!process||!TERMINAL.has(process.state))continue;
   if(resident.activePhases&&(!process.phase||!resident.activePhases.includes(process.phase)))continue;
   const phase=typeof process.phase==='string'?process.phase:null;
   const state=process.state;
   const label=state==='passed'?'resultado reportado':'fallo reportado';
   const phaseLabel=phase?PHASE_LABELS[phase]:null;
   const text=`${safeText(resident.name)} observó un ${label} del proceso ${safeText(process.label||processId)}${phaseLabel?` en la fase ${phaseLabel}`:''}.`;
   events.push({
    id:residentMemoryEventKey({residentId:resident.id,processId,state,phase},now,windowMs),
    residentId:resident.id,
    processId,
    state,
    phase,
    eventKey:residentMemoryEventKey({residentId:resident.id,processId,state,phase},now,windowMs),
    text,
    at,
   });
   if(events.length>=MAX_EVENTS)return events;
  }
 }
 return events;
}

export function residentMemorySummary(memory){
 const state=STATE_LABELS[memory?.state]||'Estado no disponible';
 const phase=memory?.phase?PHASE_LABELS[memory.phase]||memory.phase:null;
 return phase?`${state} · ${phase}`:state;
}
