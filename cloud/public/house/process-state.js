import {ROOM_IDS} from './layout.js';

export const PROCESS_PHASES=Object.freeze(['observe','understand','connect','apply','refute','retain']);
export const PROCESS_STATES=Object.freeze(['idle','running','passed','failed','waiting']);
export const PHASE_LABELS=Object.freeze({observe:'Observar',understand:'Comprender',connect:'Conectar',apply:'Aplicar',refute:'Refutar',retain:'Aprender'});
export const STATE_LABELS=Object.freeze({idle:'En reposo',running:'En ejecución',passed:'Prueba superada',failed:'Refutado',waiting:'En espera'});
const aliases={chat:'salon',research:'mind',library:'mind',tools:'body',review:'refutation',video:'cinema',creative:'games',core:'language',lor:'language',external:'constellation'};
const identifier=value=>typeof value==='string'&&/^[a-z0-9_-]{1,40}$/.test(value);
const counter=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000000;

// Only bounded display data crosses into the scene; no script, URL or model
// instruction is accepted here. Missing values remain unknown, never invented.
export function normalizeProcessState(value){
 const processes=[];
 if(Array.isArray(value?.processes))for(const raw of value.processes.slice(0,32)){
  if(!raw||!identifier(raw.id)||!PROCESS_STATES.includes(raw.state))continue;
  const room=ROOM_IDS.includes(raw.room)?raw.room:ROOM_IDS.includes(raw.id)?raw.id:Object.hasOwn(aliases,raw.id)?aliases[raw.id]:null;if(!room)continue;
  const item={id:raw.id,room,state:raw.state};
  if(typeof raw.label==='string'&&raw.label.trim())item.label=raw.label.replace(/\s+/g,' ').trim().slice(0,64);
  if(PROCESS_PHASES.includes(raw.phase))item.phase=raw.phase;
  if(raw.counters&&typeof raw.counters==='object'){
   const counters={};for(const key of ['observations','trials','accepted','rejected'])if(counter(raw.counters[key]))counters[key]=raw.counters[key];
   if(Object.keys(counters).length)item.counters=counters;
  }
  processes.push(item);
 }
 const at=typeof value?.at==='string'&&Number.isFinite(Date.parse(value.at))?new Date(value.at).toISOString():null;
 return {at,processes};
}
const priorities={running:5,failed:4,waiting:3,passed:2,idle:1};
export function processForRoom(value,room,{ageMs=0}={}){
 const process=value.processes.filter(item=>item.room===room).sort((a,b)=>priorities[b.state]-priorities[a.state])[0];
 if(!process)return {id:room,room,state:'waiting',label:'Sin telemetría'};
 if(ageMs>75000&&process.state==='running')return {...process,state:'waiting',label:'Sin señal reciente'};
 return process;
}
export function processCaption(process){
 const parts=process.label?[process.label]:[];
 if(process.phase)parts.push(PHASE_LABELS[process.phase]);
 parts.push(STATE_LABELS[process.state]);
 const counters=process.counters;
 if(counters&&counter(counters.accepted))parts.push('Aceptados '+counters.accepted);
 if(counters&&counter(counters.rejected))parts.push('Refutados '+counters.rejected);
 return parts.join(' · ');
}
export function processMotion(process,time,seed=0){
 const running=process.state==='running',t=time*4+seed;
 return {travel:running?Math.sin(time*.75+seed)*.35:0,bob:running?Math.abs(Math.sin(t))*.045:Math.sin(time*.75+seed)*.006,limb:running?Math.sin(t)*.5:0,head:process.state==='failed'?-.22:running?Math.sin(time*.8+seed)*.16:0};
}
