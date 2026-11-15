import {TELEMETRY_FRESH_MS,telemetryFreshness,STATE_LABELS,REASON_LABELS} from './process-state.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};

// A resident belongs to a physical station, not to an invented background job.
// Position is [x,y,z]; yaw follows the walking camera (0=-Z, +PI/2=+X).
// Multiple stations may reflect one real process; they are not extra agents.
const stations=[
 {id:'salon-centre',room:'salon',position:[1.3,0,2.7],yaw:-1.25,archetype:'human',processIds:['chat'],name:'Lía · conversación',role:'Conversación de Atlas',seated:false,cosmetic:false},
 {id:'music-console',room:'music',position:[-8.9,0,4],yaw:-Math.PI/2,archetype:'human',processIds:[],name:'Noa · composición',role:'Composición Web Audio local',seated:true,cosmetic:false},
 {id:'music-mixer',room:'music',position:[-6.1,0,5.9],yaw:Math.PI,archetype:'robot',processIds:[],name:'Ritmo · mezcla',role:'Mezcla musical local',seated:false,cosmetic:false},
 {id:'lab-desk',room:'lab',position:[-8.8,0,-4],yaw:-Math.PI/2,archetype:'human',processIds:['research'],name:'Vera · fuentes',role:'Lectura de fuentes públicas',seated:true,cosmetic:false},
 {id:'lab-bench',room:'lab',position:[-8.2,0,-5.35],yaw:0,archetype:'animal',processIds:['experience'],activePhases:['apply','refute'],name:'Nilo · experimentos',role:'Contraste de la experiencia',seated:false,cosmetic:false},
 {id:'games-desk',room:'games',position:[8.8,0,4],yaw:Math.PI/2,archetype:'robot',processIds:['creative'],name:'Talo · constructor',role:'Generación de planes 3D',seated:true,cosmetic:false},
 {id:'games-maquette',room:'games',position:[7.5,0,5.25],yaw:Math.PI,archetype:'animal',processIds:['creative'],name:'Zuri · maquetas',role:'Prototipos 3D con contratos',seated:false,cosmetic:false},
 {id:'cinema-projector',room:'cinema',position:[5.2,0,-4.8],yaw:Math.PI/2,archetype:'robot',processIds:['video'],name:'Faro · vídeo',role:'Generación de vídeo local',seated:false,cosmetic:false},
 {id:'sky-sources',room:'constellation',position:[-2.3,0,-5.5],yaw:0,archetype:'bird',processIds:['research','external'],name:'Alba · referencias',role:'Fuentes de la Constelación',seated:true,cosmetic:false},
 {id:'sky-agents',room:'constellation',position:[2.3,0,-5.5],yaw:0,archetype:'bird',processIds:['agents'],name:'Ícaro · agentes',role:'Colaboradores programadores',seated:true,cosmetic:false},
 {id:'mind-desk',room:'mind',position:[-10,0,-13.6],yaw:0,archetype:'human',processIds:['experience'],activePhases:['observe','understand','retain'],name:'Nora · memoria',role:'Observación y memoria situada',seated:true,cosmetic:false},
 {id:'body-console',room:'body',position:[-5.6,0,-13.6],yaw:0,archetype:'robot',processIds:['tools'],name:'Ion · herramientas',role:'Ejecución de funciones de software',seated:false,cosmetic:false},
 {id:'body-arm',room:'body',position:[-2.7,0,-13.2],yaw:.83,archetype:'robot',processIds:['tools'],name:'Pico · acciones',role:'Acciones de software · brazo simbólico',seated:false,cosmetic:false},
 {id:'refutation-candidate',room:'refutation',position:[1.6,0,-13.15],yaw:0,archetype:'human',processIds:['review'],name:'Ada · contraste',role:'Comprobación de candidatas',seated:false,cosmetic:false},
 {id:'refutation-control',room:'refutation',position:[6.4,0,-13.15],yaw:0,archetype:'robot',processIds:['weights'],name:'Cota · laboratorio',role:'Ensayos de adaptadores separados',seated:false,cosmetic:false},
 {id:'language-object',room:'language',position:[9.5,0,-13.25],yaw:0,archetype:'human',processIds:['lor'],name:'Sol · estructura',role:'Estructura del lenguaje LOR',seated:false,cosmetic:false},
 {id:'language-symbol',room:'language',position:[12,0,-13.25],yaw:0,archetype:'robot',processIds:['core'],name:'Sigma · símbolos',role:'Políticas y símbolos verificables',seated:false,cosmetic:false},
 {id:'language-meaning',room:'language',position:[14.5,0,-13.25],yaw:0,archetype:'human',processIds:['experience'],activePhases:['connect','retain'],name:'Ema · sentido',role:'Interpretación situada de la experiencia',seated:false,cosmetic:false}
];
const audience=[
 ['cinema-audience-1',6.5,-2.6,'human','Teo · espectador'],
 ['cinema-audience-2',8.2,-2.6,'robot','Luz · espectadora'],
 ['cinema-audience-3',6.5,-4.3,'human','Mara · espectadora'],
 ['cinema-audience-4',8.2,-4.3,'animal','Mico · espectador'],
 ['cinema-audience-5',6.5,-6,'human','Leo · espectador'],
 ['cinema-audience-6',8.2,-6,'bird','Brisa · espectadora']
].map(([id,x,z,archetype,name])=>({id,room:'cinema',position:[x,0,z],yaw:Math.PI/2,archetype,processIds:[],name,role:'Habitante del cine · presencia decorativa',seated:true,cosmetic:true}));

export const RESIDENTS=freeze([...stations,...audience]);
export const WORKSTATIONS=freeze(RESIDENTS.filter(resident=>!resident.cosmetic));
export const AUDIENCE=freeze(RESIDENTS.filter(resident=>resident.cosmetic));
export const residentById=id=>RESIDENTS.find(resident=>resident.id===id)||null;
export const residentsForRoom=room=>RESIDENTS.filter(resident=>resident.room===room);

const processPriorities={running:5,failed:4,waiting:3,passed:2,idle:1};
// Shared by the 3D poses and the roster: one process may visit several stations,
// but only its actual phase authorizes the resident's work indication.
export function processForResident(value,resident,{ageMs=Infinity}={}){
 if(resident.cosmetic)return {id:resident.id,state:'idle',workVerified:false,reason:'reported',displayState:STATE_LABELS.idle};
 if(!resident.processIds.length)return {id:resident.id,state:'waiting',workVerified:false,reason:'local_only',displayState:REASON_LABELS.local_only};
 const process=(value.processes||[]).filter(item=>resident.processIds.includes(item.id)).sort((a,b)=>processPriorities[b.state]-processPriorities[a.state])[0];
 if(!process)return {id:resident.id,state:'waiting',workVerified:false,reason:'no_process',displayState:REASON_LABELS.no_process};
 const freshness=telemetryFreshness(value,{ageMs,maxAgeMs:TELEMETRY_FRESH_MS});
 const relevant=!resident.activePhases||resident.activePhases.includes(process.phase);
 if(!freshness.fresh){
  const reason=freshness.reason;
  return {id:process.id,room:process.room,state:'waiting',workVerified:false,reason,displayState:REASON_LABELS[reason]||REASON_LABELS.stale};
 }
 if(process.state==='running'&&!relevant){
  const reason='wrong_phase';
  return {...process,state:'waiting',workVerified:false,reason,displayState:REASON_LABELS[reason]};
 }
 const workVerified=freshness.fresh&&relevant&&process.state==='running';
 return {...process,workVerified,reason:workVerified?'fresh':'reported',displayState:STATE_LABELS[process.state]||REASON_LABELS.reported};
}
