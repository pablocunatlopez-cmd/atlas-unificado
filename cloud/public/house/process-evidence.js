import {normalizeProcessState} from './process-state.js';

const MAX_AGE_MS=75000;
const STATES=new Set(['idle','running','passed','failed','waiting']);

/**
 * Derive a deliberately narrow epistemic label for one coordinator process.
 * This describes the source and freshness of the report; it never upgrades a
 * coordinator claim to independent verification or persistent integration.
 */
export function processEvidence(input,processId,{now=Date.now(),maxAgeMs=MAX_AGE_MS}={}){
 const data=normalizeProcessState(input);
 const process=data.processes.find(item=>item.id===processId);
 const timestamp=data.at?Date.parse(data.at):NaN;
 const ageMs=now-timestamp;
 const fresh=Number.isFinite(now)&&Number.isFinite(timestamp)&&Number.isFinite(ageMs)&&ageMs>=0&&Number.isFinite(maxAgeMs)&&maxAgeMs>=0&&ageMs<=maxAgeMs;
 const common={source:'coordinator',at:data.at,ageMs:Number.isFinite(ageMs)?ageMs:null,verified:false,integrated:false};
 if(!process)return {...common,status:'unknown',state:null,label:'Sin evidencia de proceso'};
 if(data.connected===false)return {...common,status:'waiting',state:process.state,label:'Puente desconectado; estado no confirmado'};
 if(!data.at||!Number.isFinite(timestamp))return {...common,status:'unknown',state:process.state,label:'Sin fecha de telemetría'};
 if(!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<0)return {...common,status:'unknown',state:process.state,label:'No se pudo determinar la vigencia'};
 if(ageMs<0)return {...common,status:'unknown',state:process.state,label:'Telemetría con fecha futura'};
 if(ageMs>maxAgeMs)return {...common,status:'stale',state:process.state,label:'Telemetría caducada'};
 if(!STATES.has(process.state))return {...common,status:'unknown',state:null,label:'Estado fuera del contrato'};
 const label=process.state==='running'?'Ejecución reportada por el coordinador':process.state==='passed'?'Resultado aprobado reportado; verificación independiente pendiente':process.state==='failed'?'Fallo reportado por el coordinador':process.state==='waiting'?'En espera según el coordinador':'En reposo según el coordinador';
 return {...common,status:'reported',state:process.state,label};
}
