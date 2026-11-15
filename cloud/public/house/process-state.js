import {normalizeHouseWork} from './work-courier.js';
import {ROOM_IDS} from './layout.js';
import {normalizeIcarusJourneys} from './sky-journeys.js';

export const PROCESS_PHASES=Object.freeze(['observe','understand','connect','apply','refute','retain']);
export const PROCESS_STATES=Object.freeze(['idle','running','passed','failed','waiting']);
export const TELEMETRY_FRESH_MS=75000;
export const TELEMETRY_CONTRACT_VERSION=1;
export const PHASE_LABELS=Object.freeze({observe:'Observar',understand:'Comprender',connect:'Conectar',apply:'Aplicar',refute:'Refutar',retain:'Conservar'});
export const STATE_LABELS=Object.freeze({idle:'En reposo',running:'En ejecución',passed:'Resultado reportado',failed:'Fallo reportado',waiting:'En espera'});
// Explicit reasons so the UI never invents activity from a missing or stale signal (P2).
export const REASON_LABELS=Object.freeze({
  fresh:'Señal reciente',
  no_process:'Sin telemetría',
  disconnected:'Puente desconectado',
  stale:'Sin señal reciente',
  invalid_time:'Señal con hora no válida',
  wrong_phase:'En espera de su fase',
  local_only:'Disponible · local',
  reported:'Estado reportado'
});
const aliases={experience:'mind',suceso:'constellation',agents:'constellation',weights:'refutation',chat:'salon',research:'mind',library:'mind',tools:'body',review:'refutation',video:'cinema',creative:'games',core:'language',lor:'language',external:'constellation'};
const identifier=value=>typeof value==='string'&&/^[a-z0-9_-]{1,40}$/.test(value);
const counter=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000000;

// Only bounded display data crosses into the scene; no script, URL or model
// instruction is accepted here. Missing values remain unknown, never invented.
export function normalizeProcessState(value){
 const processes=[];
 if(Array.isArray(value?.processes))for(const raw of value.processes.slice(0,32)){
  if(!raw||!identifier(raw.id)||!PROCESS_STATES.includes(raw.state))continue;
  const room=ROOM_IDS.includes(raw.room)?raw.room:ROOM_IDS.includes(raw.id)?raw.id:Object.hasOwn(aliases,raw.id)?aliases[raw.id]:null;if(!room)continue;
  const item={id:raw.id,room,state:raw.state};if(typeof raw.actorId==='string'&&/^[a-z0-9-]{1,64}$/.test(raw.actorId))item.actorId=raw.actorId;
  if(typeof raw.label==='string'&&raw.label.trim())item.label=raw.label.replace(/\s+/g,' ').trim().slice(0,64);
  if(PROCESS_PHASES.includes(raw.phase))item.phase=raw.phase;
  if(raw.counters&&typeof raw.counters==='object'){
   const counters={};for(const key of ['observations','trials','accepted','rejected'])if(counter(raw.counters[key]))counters[key]=raw.counters[key];
   if(Object.keys(counters).length)item.counters=counters;
  }
  processes.push(item);
 }
 const at=typeof value?.at==='string'&&Number.isFinite(Date.parse(value.at))?new Date(value.at).toISOString():null;
 return {at,connected:value?.connected!==false,processes,...(value?.icarus?{icarus:normalizeIcarusJourneys(value.icarus)}:{}),...(value?.houseWork?{houseWork:normalizeHouseWork(value.houseWork)}:{})};
}
const priorities={running:5,failed:4,waiting:3,passed:2,idle:1};
export function processForRoom(value,room,{ageMs=0}={}){
 const process=value.processes.filter(item=>item.room===room).sort((a,b)=>priorities[b.state]-priorities[a.state])[0];
 if(!process)return {id:room,room,state:'waiting',label:'Sin telemetría',workVerified:false};
 const fresh=value.connected!==false&&!!value.at&&Number.isFinite(ageMs)&&ageMs>=0&&ageMs<=75000;
 if(!fresh&&process.state==='running')return {...process,state:'waiting',label:value.connected===false?'Puente desconectado':'Sin señal reciente',workVerified:false};
 return {...process,workVerified:fresh&&process.state==='running'};
}
export function creatureArchetype(process,room){
 // Residents keep their identity when a different process visits the room.
 if(room==='lab')return 'animal';
 if(room==='constellation')return 'bird';
 if(['body','games','cinema','refutation'].includes(room))return 'robot';
 return 'human';
}
export function measuredChanges(value,{now=Date.now(),maxAgeMs=75000}={}){
 const timestamp=typeof value?.at==='string'?Date.parse(value.at):NaN,age=now-timestamp;
 if(!Number.isFinite(maxAgeMs)||maxAgeMs<0||value?.connected===false||!Number.isFinite(timestamp)||!Number.isFinite(age)||age<0||age>maxAgeMs)return null;
 const accepted=value?.processes?.find(item=>item.id==='experience')?.counters?.accepted;
 return counter(accepted)?accepted:null;
}
export function processCaption(process){
 const parts=process.label?[process.label]:[];
 if(process.phase)parts.push(PHASE_LABELS[process.phase]);
 parts.push(STATE_LABELS[process.state]||process.displayState||'En espera');
 if(process.reason&&process.reason!=='fresh'&&process.reason!=='reported'&&REASON_LABELS[process.reason]){
  if(!parts.includes(REASON_LABELS[process.reason]))parts.push(REASON_LABELS[process.reason]);
 }
 const counters=process.counters;
 if(counters&&counter(counters.accepted))parts.push((process.id==='experience'?'Cambios reportados ':'Aceptados reportados ')+counters.accepted);
 if(counters&&counter(counters.rejected))parts.push('Rechazados reportados '+counters.rejected);
 return parts.join(' · ');
}
export function processMotion(process,time,seed=0){
 const rest={working:false,travel:0,bob:0,limb:0,head:process.state==='failed'?-.22:0,leftArm:0,rightArm:0,wing:0,tool:0,tilt:0};
 if(process.state!=='running'||process.workVerified!==true)return rest;
 const t=time*3+seed,wave=Math.sin(t),motion={...rest,working:true};
 switch(process.phase){
  case 'observe':return {...motion,head:Math.sin(time*.8+seed)*.35,leftArm:-.22,rightArm:.16,wing:wave*.16,travel:Math.sin(time*.45+seed)*.06};
  case 'connect':return {...motion,head:wave*.13,leftArm:.5+wave*.15,rightArm:-.5-wave*.15,wing:wave*.65,bob:Math.abs(wave)*.06,travel:Math.sin(time*.65+seed)*.15};
  case 'apply':return {...motion,limb:wave*.12,leftArm:.25+wave*.25,rightArm:-.35-wave*.45,tool:Math.max(0,wave)*.22,bob:Math.abs(wave)*.025,tilt:.1};
  case 'refute':return {...motion,head:-.2+wave*.08,leftArm:.15,rightArm:-.55-wave*.16,tool:wave*.07,tilt:.18};
  case 'retain':return {...motion,head:-.1,leftArm:-.25,rightArm:-.15+wave*.13,tool:wave*.035};
  default:return {...motion,head:wave*.14,leftArm:-.4+wave*.07,rightArm:.2,wing:wave*.12,limb:wave*.06};
 }
}
