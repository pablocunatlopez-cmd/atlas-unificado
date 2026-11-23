import {ROOMS} from './layout.js';
import {residentById} from './residents.js';
const scopes=new Set(['room:mind','module:workshop']);
export const HOUSE_ZONES=Object.freeze(ROOMS.map(room=>Object.freeze({id:room.id,level:0,utility:room.kind})));
export const HOUSE_FUNCTIONS=Object.freeze([
 Object.freeze({id:'mind-cabinet',kind:'cabinet',owner:'mind-desk',tool:'memory',room:'mind',label:'Archivo de Mente',utility:'Conservar y recuperar información del ámbito Mente.',scope:'room:mind',position:[-14.8,1.25,-14.8],links:['project-cabinet','ion-workbench']}),
 Object.freeze({id:'project-cabinet',kind:'cabinet',owner:'games-desk',tool:'memory',room:'mind',label:'Archivo de diseños',utility:'Conservar decisiones, objetivos y contexto del taller de ERAS.',scope:'module:workshop',position:[-13.5,1.25,-14.8],links:['ion-workbench','mind-cabinet']}),
 Object.freeze({id:'ion-workbench',kind:'workbench',owner:'body-console',tool:'eras',room:'body',label:'Construir con ERAS',utility:'Diseñar entornos y conservar sus proyectos en el taller.',position:[-5.6,.9,-14.8],links:['project-cabinet','mind-cabinet','world-maquette','cinema-screen']}),
 Object.freeze({id:'lia-core',kind:'tool',tool:'chat',owner:'salon-centre',room:'salon',label:'Conversar con Lía',utility:'Integrar lo aprendido en la conversación con Lía.',position:[0,1.4,2.3],size:[1.5,2.2,1.5],links:['mind-cabinet','sky-observatory']}),
 Object.freeze({id:'music-piano',kind:'tool',tool:'music',owner:'music-console',room:'music',label:'Piano de Noa',utility:'Componer, escuchar y guardar música en el estudio.',position:[-10,1,4],size:[1.1,1.7,2.5],links:['music-mixer','cinema-screen']}),
 Object.freeze({id:'music-mixer',kind:'tool',tool:'music',owner:'music-mixer',room:'music',label:'Mesa de Ritmo',utility:'Trabajar el arreglo y la reproducción de las composiciones.',position:[-6.1,.9,6.8],size:[2,1.4,1],links:['music-piano','cinema-screen']}),
 Object.freeze({id:'cinema-screen',kind:'instrument',tool:'cinema',workspace:'cinema',owner:'cinema-projector',room:'cinema',label:'Pantalla de Faro',utility:'Planificar y grabar planos de la casa 3D existente.',position:[11.55,1.8,-4],hitSize:[.35,2.35,5.8],links:['project-cabinet','ion-workbench','music-piano','world-maquette']}),
 Object.freeze({id:'world-maquette',kind:'tool',tool:'game',owner:'games-maquette',room:'games',label:'Maqueta de Zuri',utility:'Crear proyectos jugables y probar la misma casa como videojuego.',position:[7.5,1,6.5],size:[2.4,1.5,1.7],links:['ion-workbench','project-cabinet','cinema-screen']}),
 Object.freeze({id:'research-desk',kind:'tool',tool:'research',owner:'lab-desk',room:'lab',label:'Mesa de Vera',utility:'Consultar investigación y referencias conservadas en Sites.',position:[-10,1,-4],size:[1.1,1.7,2.5],links:['sky-observatory','mind-cabinet']}),
 Object.freeze({id:'sky-observatory',kind:'tool',tool:'constellation',owner:'sky-agents',room:'constellation',label:'Observatorio de Ícaro',utility:'Consultar fuentes, agentes y los viajes de conocimiento.',position:[0,1.3,-5.5],size:[1.6,2,1.6],links:['research-desk','lia-core']}),
 Object.freeze({id:'review-gate',kind:'tool',tool:'observatory',owner:'refutation-candidate',room:'refutation',label:'Mesa de Ada',utility:'Revisar candidatas, pruebas y decisiones del sistema existente.',position:[1.6,1,-14.4],size:[1.6,1.6,1.3],links:['world-maquette','mind-cabinet']}),
 Object.freeze({id:'language-symbols',kind:'tool',tool:'observatory',owner:'language-symbol',room:'language',label:'Símbolos de Sigma',utility:'Explorar los símbolos y contratos del lenguaje LOR.',position:[12,1,-14.4],size:[1.1,1.7,1.1],links:['review-gate','lia-core']})
]);
export const houseFunction=id=>HOUSE_FUNCTIONS.find(item=>item.id===id)||null;
/** A useful object needs an executable binding, not just a narrative purpose. */
export function validateFunctionalIntent(value){
 if(!value||typeof value!=='object')throw Error('Falta la función del componente.');
 if(value.kind==='stairs'){
  const from=HOUSE_ZONES.find(z=>z.id===value.from),to=HOUSE_ZONES.find(z=>z.id===value.to);
  if(!from||!to||from.id===to.id||from.level===to.level)throw Error('La escalera necesita dos zonas útiles de niveles distintos y una conexión implementada.');
  throw Error('Falta un recorrido vertical transitable implementado.');
 }
 const definition=houseFunction(value.id);if(!definition||value.kind!==definition.kind)throw Error('El componente no tiene una función implementada.');
 if(definition.kind==='instrument'&&(value.workspace!=='cinema'||value.workspace!==definition.room))throw Error('El instrumento necesita su taller implementado correcto.');
 if(definition.kind==='cabinet'&&(!scopes.has(value.scope)||value.scope!==definition.scope))throw Error('El armario necesita su ámbito de información correcto.');
 if(!residentById(definition.owner)||!definition.utility||!definition.links.length||definition.links.some(id=>!houseFunction(id)))throw Error('El componente está desconectado del mundo funcional.');
 return definition;
}
