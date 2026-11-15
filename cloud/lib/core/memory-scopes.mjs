import {RESIDENTS} from '../../public/house/residents.js';
import {ROOMS} from '../../public/house/layout.js';

// These are the four current product surfaces, not a claim about the unnamed
// historical modules. The house remains the integrated environment.
export const MEMORY_MODULES=Object.freeze([
 {id:'house',label:'Casa de Lía'},
 {id:'chat',label:'Chat'},
 {id:'activity',label:'Actividad'},
 {id:'workshop',label:'Taller'},
]);

const residentIds=new Set(RESIDENTS.map(resident=>resident.id));
const roomIds=new Set(ROOMS.map(room=>room.id));
const moduleIds=new Set(MEMORY_MODULES.map(module=>module.id));
const residentLabels=new Map(RESIDENTS.map(resident=>[resident.id,resident.name]));
const roomLabels=new Map(ROOMS.map(room=>[room.id,room.title]));
const moduleLabels=new Map(MEMORY_MODULES.map(module=>[module.id,module.label]));

// A scope is a closed key. A name that is not in the executable roster or the
// current room list cannot become a new namespace by being written into state.
export function isMemoryScope(value){
 if(value==='global')return true;
 if(typeof value!=='string')return false;
 const parts=value.split(':');
 if(parts.length!==2||!parts[1])return false;
 const [kind,id]=parts;
 if(kind==='resident')return residentIds.has(id);
 if(kind==='room')return roomIds.has(id);
 if(kind==='module')return moduleIds.has(id);
 return false;
}

export function memoryScope(value){
 return isMemoryScope(value)?value:'global';
}

export function memoryScopeOptions(){
 return [
  {value:'global',label:'General · toda la casa',group:'General'},
  ...RESIDENTS.map(resident=>({value:`resident:${resident.id}`,label:resident.name,group:'Habitantes'})),
  ...ROOMS.map(room=>({value:`room:${room.id}`,label:room.title,group:'Salas'})),
  ...MEMORY_MODULES.map(module=>({value:`module:${module.id}`,label:module.label,group:'Módulos'})),
 ];
}

export function memoryScopeLabel(value){
 const scope=memoryScope(value);
 if(scope==='global')return 'General';
 const [kind,id]=scope.split(':');
 if(kind==='resident')return residentLabels.get(id)||id;
 if(kind==='room')return roomLabels.get(id)||id;
 return moduleLabels.get(id)||id;
}
