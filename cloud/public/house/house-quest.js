import {houseFunction} from './functional-world.js';
export function createHouseQuest(brief=''){
 const music=/m[uú]sica|piano|sonido/i.test(brief),film=/cine|v[ií]deo|pel[ií]cula/i.test(brief);
 const tasks=[
  {id:'mind-cabinet',title:'Recupera la idea del Archivo de Mente',item:'idea',requires:null},
  {id:music?'music-piano':film?'cinema-screen':'world-maquette',title:music?'Lleva la idea al piano de Noa':film?'Convierte la idea en un plano en el cine':'Lleva la idea a la maqueta de Zuri',item:'prototipo',requires:'idea'},
  {id:'review-gate',title:'Lleva el prototipo a la mesa de Ada',item:'revisión',requires:'prototipo'},
  {id:'lia-core',title:'Entrega la revisión a Lía en el salón',item:'integración',requires:'revisión'}
 ];
 return{version:1,tasks,step:0,inventory:[],visits:[],completed:false};
}
export function advanceHouseQuest(previous,id){
 const fn=houseFunction(id);if(!fn)return{state:previous,accepted:false,message:'Este objeto no tiene una interacción registrada.'};
 const task=previous.tasks[previous.step];
 if(previous.completed)return{state:previous,accepted:false,message:'Misión completada. Puedes seguir explorando o empezar otra vez.'};
 if(id!==task.id||task.requires&&!previous.inventory.includes(task.requires))return{state:previous,accepted:false,message:fn.label+': primero '+task.title.toLocaleLowerCase('es-ES')+'.'};
 const state={...previous,step:previous.step+1,inventory:[...previous.inventory,task.item],visits:[...previous.visits,id],completed:previous.step+1===previous.tasks.length};
 return{state,accepted:true,message:state.completed?'Has integrado el recorrido completo en Lía.':'Has obtenido: '+task.item+'.'};
}
export function housePrototypeRequest(question){
 if(typeof question!=='string')return false;
 const text=question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(/\b(no|nunca)\s+(quiero|hagas|crees|generes|construyas)\b/.test(text)||/\b(explica|analiza|describe|cuando|si te|como crear|como puedo)\b/.test(text))return false;
 return /^(por favor[, ]+)?(crea|crear|haz|genera|generar|construye|programa|quiero)\b/.test(text)&&/videojuego|juego\b/.test(text)&&/casa|\blia\b|habitacion/.test(text);
}
export const housePrototypeHref=brief=>'/jugar/casa?brief='+encodeURIComponent(String(brief).slice(0,600)).replace(/[()]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
