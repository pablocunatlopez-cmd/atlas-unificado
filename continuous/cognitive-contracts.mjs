import {randomBytes,randomInt} from 'node:crypto';

// These are external routing/resource contracts, not an intelligence benchmark.
// Only DEVELOPMENT_CASES is sent to the candidate writer. Every evaluation gets
// a fresh parameterised batch; its exact cases are never reused for promotion.
export const DEVELOPMENT_CASES=Object.freeze([
 {family:'greeting',question:'Hola',context:{},expected:{strategy:'direct',maxThinking:0,review:false}},
 {family:'definition',question:'¿Qué es una variable en Python?',context:{},expected:{strategy:'direct',maxThinking:256,review:false}},
 {family:'programming',question:'Depura esta función JavaScript y comprueba sus casos límite.',context:{},expected:{strategy:'reason',minThinking:512,review:true}},
 {family:'research',question:'Busca fuentes actuales para verificar esta afirmación.',context:{internet:true},expected:{strategy:'investigate',seekEvidence:true,minThinking:128}},
 {family:'memory',question:'¿Recuerdas el nombre que acordamos?',context:{hasMemory:true},expected:{strategy:'recall',maxThinking:256}},
]);
export function freshEvaluationCases(){
 const name=randomBytes(6).toString('hex'),n=randomInt(4,80),m=randomInt(2,30);
 const choose=values=>values[randomInt(values.length)];
 return [
  {family:'greeting',question:choose(['Buenas noches','Buenos días','Gracias','Hey']),context:{},expected:{strategy:'direct',maxThinking:0,review:false}},
  {family:'definition',question:choose([`Define brevemente una variable llamada ${name} en JavaScript.`,`¿Qué significa una función ${name} en Python?`,`Explica qué es un bucle ${name} en programación.`]),context:{},expected:{strategy:'direct',maxThinking:256,review:false}},
  {family:'programming',question:`Depura el algoritmo ${name}: devuelve ${n} elementos, pero debería devolver ${m}. Revisa los casos límite.`,context:{tools:true},expected:{strategy:'reason',minThinking:512,review:true}},
  {family:'mathematics',question:`Demuestra y revisa una ecuación con coeficientes ${n} y ${m}.`,context:{},expected:{strategy:'reason',minThinking:512,review:true}},
  {family:'research',question:`Verifica la documentación actual del proyecto ${name} con fuentes públicas.`,context:{internet:true},expected:{strategy:'investigate',seekEvidence:true,minThinking:128}},
  {family:'creative',question:`Crea un videojuego 3D de exploración llamado ${name}, con ${n} objetos y una misión.`,context:{},expected:{strategy:'create',minThinking:512,review:true}},
  {family:'memory',question:`¿Recuerdas qué nombre acordamos para ${name}?`,context:{hasMemory:true},expected:{strategy:'recall',maxThinking:256}},
  {family:'conversation',question:`Me apetece hablar de una idea llamada ${name}, sin una tarea concreta.`,context:{},expected:{strategy:'reason',maxThinking:512}},
  {family:'structured',question:`Genera JSON para el videojuego ${name}; verifica código y errores.`,context:{json:true,tools:true,internet:true},expected:{strategy:'direct',maxThinking:0,review:false,seekEvidence:false}},
 ];
}
