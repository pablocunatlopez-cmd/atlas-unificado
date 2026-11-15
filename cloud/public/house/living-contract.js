import {ROOM_IDS} from './layout.js';
export const LIVING_SHAPES=Object.freeze(['box','sphere','cylinder','torus','arch','helix','crystal','wave','bloom']);
export const LIVING_STYLES=Object.freeze(['gallery','observatory','garden','arcade']);
export const LIVING_FLOORS=Object.freeze(['grid','rings','tiles']);
const defaultEnvironment=()=>({style:'gallery',floor:'grid',intensity:.45});
const artifactId=v=>typeof v==='string'&&/^living-[a-f0-9]{24}$/.test(v);
const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const number=(v,a,b,label)=>{if(!finite(v,a,b))throw Error(label+' fuera de rango.');return v;};
export function validateLivingProposal(raw){
 if(!raw||typeof raw!=='object'||typeof raw.title!=='string'||raw.title.trim().length<3||raw.title.length>90||typeof raw.goal!=='string'||raw.goal.length>300)throw Error('Falta un título y objetivo acotados.');
 if(!Array.isArray(raw.colors)||raw.colors.length!==3||raw.colors.some(c=>typeof c!=='string'||!/^#[a-f0-9]{6}$/i.test(c)))throw Error('Se requieren tres colores hexadecimales.');
 if(!Array.isArray(raw.objects)||!raw.objects.length||raw.objects.length>8)throw Error('La obra admite entre uno y ocho objetos.');
 const objects=raw.objects.map(o=>{if(!o||!LIVING_SHAPES.includes(o.shape))throw Error('Forma no admitida.');return{shape:o.shape,x:number(o.x,-1.5,1.5,'X'),y:number(o.y,0,1,'Y'),z:number(o.z,-1.5,1.5,'Z'),size:number(o.size,.15,.65,'Tamaño'),color:Math.round(number(o.color,0,2,'Color'))};});
 if(!Array.isArray(raw.program)||raw.program.length>12)throw Error('Programa de movimiento demasiado largo.');
 const program=raw.program.map(p=>{if(!p||!['rotate','float','pulse'].includes(p.op)||!Number.isInteger(p.target)||p.target<0||p.target>=objects.length)throw Error('Instrucción de escena inválida.');return{op:p.op,target:p.target,speed:number(p.speed,.1,1,'Velocidad'),amount:number(p.amount,0,.1,'Amplitud')};});
 const m=raw.music;if(!m||!Array.isArray(m.notes)||m.notes.length!==16||m.notes.some(n=>!Number.isInteger(n)||n<36||n>72))throw Error('La composición requiere 16 notas MIDI entre 36 y 72.');
 const music={bpm:Math.round(number(m.bpm,60,160,'Tempo')),swing:number(m.swing,0,.25,'Swing'),notes:[...m.notes]};
 for(const id of ['kick','snare','hat','bass']){if(!Array.isArray(m[id])||m[id].length>16||m[id].some(n=>!Number.isInteger(n)||n<0||n>15))throw Error('Pasos musicales inválidos.');music[id]=[...new Set(m[id])];}
 if(music.kick.length<1||music.bass.length<2)throw Error('La composición necesita ritmo y notas activas.');
 const f=raw.film;if(!f||!Array.isArray(f.rooms)||f.rooms.length<1||f.rooms.length>4||f.rooms.some(r=>!ROOM_IDS.includes(r)))throw Error('Guion de cámara inválido.');
 const film={rooms:[...f.rooms],seconds:Math.round(number(f.seconds,4,16,'Duración'))};
 let environment=defaultEnvironment();
 if(raw.environment!==undefined){const e=raw.environment;if(!e||typeof e!=='object'||!LIVING_STYLES.includes(e.style)||!LIVING_FLOORS.includes(e.floor))throw Error('Ambiente arquitectónico inválido.');environment={style:e.style,floor:e.floor,intensity:number(e.intensity,.2,.8,'Intensidad')};}
 return{version:1,title:raw.title.trim(),goal:raw.goal.trim(),colors:[...raw.colors],objects,program,music,film,environment,walk:raw.walk===true};
}
export function livingPattern(proposal){
 const p=validateLivingProposal(proposal),m=p.music,volumes={kick:.7,snare:.48,hat:.24,bass:.4};
 return{version:1,bpm:m.bpm,swing:m.swing,master:.55,tracks:Object.fromEntries(['kick','snare','hat','bass'].map(id=>[id,{steps:Array.from({length:16},(_,i)=>m[id].includes(i)),volume:volumes[id],mute:false}])),bassNotes:m.notes};
}
function validateLivingExperiment(raw){
 if(!raw||typeof raw!=='object'||!artifactId(raw.parentId)||typeof raw.metric!=='string'||!raw.metric.trim()||raw.metric.length>80||!finite(raw.before,-1e6,1e6)||!finite(raw.after,-1e6,1e6)||!validDate(raw.at))return;
 if(raw.changes!==undefined&&(!Array.isArray(raw.changes)||raw.changes.length>8||raw.changes.some(c=>typeof c!=='string'||!c.trim()||c.length>160)))return;
 return{parentId:raw.parentId,metric:raw.metric.trim(),before:raw.before,after:raw.after,at:new Date(raw.at).toISOString(),...(raw.changes!==undefined?{changes:raw.changes.map(c=>c.trim())}:{})};
}
export function validateLivingState(value){
 const artifacts=/** @type {Record<string,{id:string,room:string,actorId:string,actorName:string,at:string,proposal:ReturnType<typeof validateLivingProposal>,origin?:'model'|'tool-experiment'|'design-kit',parentId?:string,experiment?:ReturnType<typeof validateLivingExperiment>}>} */({});for(const room of ROOM_IDS){const item=value?.artifacts?.[room];if(!item)continue;
  if(!artifactId(item.id)||typeof item.actorId!=='string'||!/^resident:[a-z0-9-]{1,64}$/.test(item.actorId)||!validDate(item.at))continue;
  try{const experiment=item.origin==='tool-experiment'?validateLivingExperiment(item.experiment):undefined;artifacts[room]={id:item.id,room,actorId:item.actorId,actorName:String(item.actorName||'Atlas').slice(0,80),at:item.at,proposal:validateLivingProposal(item.proposal),...(['model','design-kit'].includes(item.origin)?{origin:item.origin}:experiment?{origin:'tool-experiment',experiment}:{}),...(item.origin==='design-kit'&&artifactId(item.parentId)?{parentId:item.parentId}:{})};}catch{}
 }
 return{artifacts};
}
