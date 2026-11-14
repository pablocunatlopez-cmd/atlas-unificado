import {ROOM_IDS} from './layout.js';

export const PROCESS_PHASES=Object.freeze(['observe','understand','connect','apply','refute','retain']);
export const PROCESS_STATES=Object.freeze(['idle','running','passed','failed','waiting']);
export const PHASE_LABELS=Object.freeze({observe:'Observar',understand:'Comprender',connect:'Conectar',apply:'Aplicar',refute:'Refutar',retain:'Conservar'});
// These are coordinator-reported outcomes, not independent evidence or integration claims.
export const STATE_LABELS=Object.freeze({idle:'En reposo',running:'En ejecución',passed:'Resultado reportado',failed:'Fallo reportado',waiting:'En espera'});
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
 return {at,connected:value?.connected!==false,processes};
}
const priorities={running:5,failed:4,waiting:3,passed:2,idle:1};
export function processForRoom(value,room,{ageMs=0}={}){
 const process=value.processes.filter(item=>item.room===room).sort((a,b)=>priorities[b.state]-priorities[a.state])[0];
 if(!process)return {id:room,room,state:'waiting',label:'Sin telemetría',workVerified:false};
 const fresh=value.connected!==false&&!!value.at&&Number.isFinite(ageMs)&&ageMs>=0&&ageMs<=75000;
 if(!fresh&&process.state==='running')return {...process,state:'waiting',label:value.connected===false?'Puente desconectado':'Sin señal reciente',workVerified:false};
 // workVerified here means only that recent running telemetry was received.
 // It does not mean the task result or an artifact was independently verified.
 return {...process,workVerified:fresh&&process.state==='running'};
}
export function creatureArchetype(process,room){
 // Residents keep their identity when a different process visits the room.
 if(room==='lab')return 'animal';
 if(room==='constellation')return 'bird';
 if(['body','games','cinema','refutation'].includes(room))return 'robot';
 return 'human';
}
export function measuredChanges(value){
 const accepted=value?.processes?.find(item=>item.id==='experience')?.counters?.accepted;
 return counter(accepted)?accepted:null;
}
export function processCaption(process){
 const parts=process.label?[process.label]:[];
 if(process.phase)parts.push(PHASE_LABELS[process.phase]);
 parts.push(STATE_LABELS[process.state]);
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
