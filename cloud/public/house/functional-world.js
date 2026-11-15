import {ROOMS} from './layout.js';
const scopes=new Set(['room:mind','module:workshop']);
export const HOUSE_ZONES=Object.freeze(ROOMS.map(room=>Object.freeze({id:room.id,level:0,utility:room.kind})));
export const HOUSE_FUNCTIONS=Object.freeze([
 Object.freeze({id:'mind-cabinet',kind:'cabinet',room:'mind',label:'Archivo de Mente',utility:'Conservar y recuperar información del ámbito Mente.',scope:'room:mind',position:[-14.8,1.25,-14.8],links:['project-cabinet','ion-workbench']}),
 Object.freeze({id:'project-cabinet',kind:'cabinet',room:'mind',label:'Archivo de diseños',utility:'Conservar decisiones, objetivos y contexto del taller de ERAS.',scope:'module:workshop',position:[-13.5,1.25,-14.8],links:['ion-workbench','mind-cabinet']}),
 Object.freeze({id:'ion-workbench',kind:'workbench',room:'body',label:'Construir con ERAS',utility:'Diseñar entornos y conservar sus proyectos en el taller.',position:[-5.6,.9,-14.8],links:['project-cabinet','mind-cabinet']})
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
 if(definition.kind==='cabinet'&&(!scopes.has(value.scope)||value.scope!==definition.scope))throw Error('El armario necesita su ámbito de información correcto.');
 if(!definition.utility||!definition.links.length||definition.links.some(id=>!houseFunction(id)))throw Error('El componente está desconectado del mundo funcional.');
 return definition;
}
