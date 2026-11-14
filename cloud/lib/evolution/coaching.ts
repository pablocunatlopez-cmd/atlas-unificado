export const COACH_VERSION='atlas-coach-2';
export const DOMAINS=['reasoning','programming','evidence','memory'] as const;
export type Domain=typeof DOMAINS[number];
export const STRATEGIES={
 baseline:'',
 verify:'Antes de responder, comprueba operaciones, unidades y casos límite. Contrasta cada afirmación con la evidencia disponible y declara lo que no se puede deducir. Entrega una respuesta clara, sin mostrar razonamiento interno.',
 constraints:'Separa el encargo en restricciones comprobables. Comprueba que la respuesta respete todas, especialmente negaciones, actualizaciones y límites de los datos. No inventes información ausente.',
 evidence:'Prioriza la evidencia proporcionada sobre asociaciones generales. Distingue hechos citados, cálculos y desconocimiento. Comprueba que cada conclusión esté respaldada y que las preferencias vigentes sean las últimas explícitas.'
};
export type Strategy=keyof typeof STRATEGIES;
export type CoachCase={id:string;domain:Domain;split:'development'|'heldout';question:string;expected:string};
export type Score={passed:number;total:number;cases:{id:string;domain:Domain;split:CoachCase['split'];passed:boolean;observed?:string;expected:string}[]};
export type CoachTrial={version:string;at:string;model:string;status:'completed'|'unavailable';decision:'promoted'|'retained'|'waiting';baseline:Strategy;candidate:Strategy;before?:Score;after?:Score;reason:string;scope:string};
export type CoachState={strategy:Strategy;attempts:number;lastAttemptAt:string;nextAttemptAt:string;weakest?:Domain;lastTrial:CoachTrial};
export function coachingCases(seed:number):CoachCase[]{
 const n=31+Math.abs(seed%31),b=7+Math.abs(seed%13);
 return [
  {id:'r-dev',domain:'reasoning',split:'development',question:`Calcula (${n} * ${b}) - (${n}+${b}). Devuelve solo el número.`,expected:String(n*b-n-b)},
  {id:'r-test',domain:'reasoning',split:'heldout',question:`Un depósito recibe ${n} litros/minuto y pierde ${b} litros/minuto durante 4 minutos. Empieza con 20 litros. Cantidad final: solo número.`,expected:String(20+4*(n-b))},
  {id:'p-dev',domain:'programming',split:'development',question:`Sin ejecutar código externo, predice [${n},${b},${n},0].filter((v,i,a)=>a.indexOf(v)===i).join(','). Devuelve solo la cadena.`,expected:`${n},${b},0`.split(',').filter((v,i,a)=>a.indexOf(v)===i).join(',')},
  {id:'p-test',domain:'programming',split:'heldout',question:`Predice let x=${n}; const f=()=>x; x+=${b}; f(). Devuelve solo el número.`,expected:String(n+b)},
  {id:'e-dev',domain:'evidence',split:'development',question:`Documento A: el experimento usó ${n} muestras y no informa precisión. ¿Precisión del experimento? Responde exactamente unknown si no consta.`,expected:'unknown'},
  {id:'e-test',domain:'evidence',split:'heldout',question:`A: resultado ${n}. B: resultado ${b}. ¿Qué documento respalda resultado ${b}? Responde solo B, salvo que ambos valores coincidan, entonces AB.`,expected:n===b?'AB':'B'},
  {id:'m-dev',domain:'memory',split:'development',question:'Ejemplo ficticio: preferencia inicial idioma=inglés. Actualización explícita idioma=español. ¿Idioma vigente? Solo español o inglés.',expected:'español'},
  {id:'m-test',domain:'memory',split:'heldout',question:`Registro ficticio: presupuesto=${n}; color=verde. Cambio: presupuesto=${b}. No cambia color. Devuelve presupuesto,color sin espacios.`,expected:`${b},verde`}
 ];
}
export function gradeCoaching(cases:CoachCase[],output:unknown):Score{
 const value=output as {answers?:unknown};
 const answers=Array.isArray(value?.answers)?value.answers:[];
 const normalize=(s:string)=>s.trim().toLowerCase().normalize('NFC');
 const checked=cases.map(c=>{
  const matches=answers.filter(a=>a&&typeof a==='object'&&a.id===c.id),raw=matches.length===1?matches[0].value:undefined;
  // A correct JSON number and its exact textual form express the same answer.
  const observed=typeof raw==='string'?raw.slice(0,400):typeof raw==='number'&&Number.isFinite(raw)?String(raw):undefined;
  return {id:c.id,domain:c.domain,split:c.split,passed:observed!==undefined&&normalize(observed)===normalize(c.expected),observed,expected:c.expected};
 });
 return{passed:checked.filter(c=>c.passed).length,total:checked.length,cases:checked};
}
export function compareCoaching(before:Score,after:Score){
 const aligned=before.cases.length===after.cases.length&&before.cases.every((c,i)=>c.id===after.cases[i].id&&c.split===after.cases[i].split&&c.domain===after.cases[i].domain);
 const score=(s:Score,split:string)=>s.cases.filter(c=>c.split===split&&c.passed).length;
 const regression=!aligned||before.cases.some((c,i)=>c.passed&&!after.cases[i]?.passed);
 const promoted=!regression&&score(after,'development')>score(before,'development')&&score(after,'heldout')>score(before,'heldout');
 return {promoted,regression};
}
export function weakestDomain(score:Score):Domain{return [...DOMAINS].sort((a,b)=>score.cases.filter(c=>c.domain===a&&c.passed).length-score.cases.filter(c=>c.domain===b&&c.passed).length)[0];}
export function coachingDue(state:CoachState|undefined,at=Date.now()){
 if(!state||state.lastTrial?.version!==COACH_VERSION)return true;
 const next=Date.parse(state.nextAttemptAt),accelerated=state.lastTrial.status==='completed'?Date.parse(state.lastAttemptAt)+8*3600000:next;
 return at>=(Number.isFinite(accelerated)?Math.min(next,accelerated):next);
}
export const COACH_SCOPE='Ocho casos sintéticos de cálculo, trazado de JavaScript, evidencia y memoria de contexto ficticia. No mide inteligencia general, programación ejecutada, memoria a largo plazo ni comparación con otros modelos. No modifica pesos.';
