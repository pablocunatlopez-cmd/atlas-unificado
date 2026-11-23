import {residentById} from '../../public/house/residents.js';
import {personalities} from '../../public/house/personalities.js';
import {selectPersonalMemories,type PersonalMemory} from './personal-context.ts';

export const DESIGN_TEAM=['games-desk','games-maquette','body-console'] as const;
export function residentPersonality(id:string,content?:string|null,question=''){
 const resident=residentById(id);if(!resident)return null;
 const scope='resident:'+id;
 return{id,name:resident.name,role:resident.role,scope,temperament:personalities[id]||resident.name+' contribuye desde la observación y la revisión de su especialidad.',principles:selectPersonalMemories(content,question,[scope]).slice(0,4),source:'Perfil inicial del proyecto y criterios guardados por la persona. No es entrenamiento de pesos.'};
}
export function teamMemories(ids:readonly string[],content:string|null|undefined,question:string):PersonalMemory[]{
 return ids.flatMap(id=>{
  const profile=residentPersonality(id,content,question);if(!profile)return [];
  return[{title:profile.name,text:profile.temperament,kind:'Perfil del especialista',status:'Perfil inicial',date:'',scope:profile.scope},...profile.principles.slice(0,2)];
 });
}

export const designTeamMemories=(content:string|null|undefined,question:string)=>teamMemories(DESIGN_TEAM,content,question);
