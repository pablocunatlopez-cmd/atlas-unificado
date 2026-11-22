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
 // Recognise the requested deliverable, not merely words mentioned in a question.
 if(/\b(?:no|nunca)\s+(?:lo\s+)?(?:quiero|hagas|crees|generes|construyas|programes)\b/.test(text))return false;
 const request=text.replace(/^(?:por favor[, ]+)/,'');
 const action=/^(?:crea|crear|haz|genera|generar|construye|programa)\s+/;
 const desire=/^quiero\s+(?:que\s+(?:me\s+)?(?:crees|hagas|generes|construyas|programes)\s+)?/;
 const head=action.exec(request)||desire.exec(request);if(!head)return false;
 const deliverable=request.slice(head[0].length);
 return /^(?:(?:un|el|este|otro)\s+)?(?:(?:pequeno|nuevo|sencillo|simple|jugable|original|3d)\s+){0,2}(?:(?:prototipo|demo)\s+de\s+(?:(?:un|el)\s+)?)?(?:videojuego|juego)\b/.test(deliverable)&&/\b(?:casa|lia|habitacion)\b/.test(text);
}
export const housePrototypeHref=brief=>'/jugar/casa?brief='+encodeURIComponent(String(brief).slice(0,600)).replace(/[()]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
