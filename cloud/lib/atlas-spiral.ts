import {z} from 'zod';
import {tokens,capabilityTests,type Knowledge} from './atlas-core.ts';

export const SPIRAL_VERSION='atlas-spiral-1';
export const phases=['Observar','Comprender','Conectar','Aplicar','Refutar','Aprender'] as const;
const short=z.string().max(4000),date=z.string().max(50);
const sourceSchema=z.object({key:z.string().max(240),id:z.string().max(180),title:z.string().max(240),hash:z.string().regex(/^[a-f0-9]{64}$/),date,kind:z.string().max(100),url:z.string().max(2000)});
const observationSchema=z.object({id:z.string().max(240),sourceKey:z.string().max(240),title:z.string().max(240),text:z.string().max(1800),label:z.enum(['Dato aportado','Registro histórico','Mandato recuperado']),date,url:z.string().max(2000)});
const cycleSchema=z.object({id:z.string().max(100),number:z.number().int().min(1),date,question:short,phases:z.array(z.object({name:z.enum(phases),result:short})).length(6),sourceKeys:z.array(z.string().max(240)).max(4),observationIds:z.array(z.string().max(240)).max(12),connections:z.array(z.object({from:z.string().max(240),to:z.string().max(240),shared:z.array(z.string().max(80)).max(8),status:z.literal('Coincidencia léxica')})).max(12),checks:z.array(z.object({name:z.string().max(180),passed:z.boolean(),detail:short})).max(12),novelty:z.object({evidence:z.number().int().min(0),newErrors:z.number().int().min(0),resolvedPredictions:z.literal(0),ruleChanges:z.literal(0),prunedConnections:z.literal(0)}),before:z.number().int(),after:z.number().int(),nextQuestion:short,frame:z.object({object:short,environment:short,perspective:short,scale:short,elevation:short}),semiosis:z.object({object:short,sign:short,interpretant:short}),triangle:z.object({center:short,animal:short,mind:short,event:short}),tribunal:z.object({facts:z.array(short).max(10),inferences:z.array(short).max(10),hypotheses:z.array(short).max(10),metaphors:z.array(short).max(10),axioms:z.array(short).max(10),unknowns:z.array(short).max(10)}),progress:z.object({scientific:short,technical:short,economic:short})});
export const learningSchema=z.object({sources:z.array(sourceSchema).max(96),observations:z.array(observationSchema).max(300),cycles:z.array(cycleSchema).max(60),negativeMemory:z.array(short).max(100),evaluatedVersion:z.string().max(100),nextQuestion:short,lastCheck:z.object({date,result:z.enum(['Aprendizaje registrado','Sin novedad','Límite de archivo']),reason:short}).optional()});
export type LearningState=z.infer<typeof learningSchema>;
export type LearningCycle=z.infer<typeof cycleSchema>;
export const initialLearning=():LearningState=>({sources:[],observations:[],cycles:[],negativeMemory:[
 'Un informe de ChatGPT no demuestra una capacidad ejecutada por el programa.',
 'Importar un documento amplía memoria; no verifica su verdad ni entrena pesos.',
 'Repetir la misma prueba o el mismo texto no añade aprendizaje.',
 'Coincidencia léxica no demuestra una relación causal.',
 'La numeración C del programa no modifica las preguntas Q de la investigación.'
],evaluatedVersion:'',nextQuestion:'¿Qué estado, errores y restricciones del Atlas original debo conservar antes de seguir?'});
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
export function extractObservations(text:string):string[]{
 const lines=text.replace(/```[\s\S]*?```/g,'').split(/\n\s*\n|\n(?=[*-] )/).map(s=>s.replace(/^#+\s*/,'').trim()).filter(s=>s.length>40&&!/^\|/.test(s));
 const ranked=lines.map((line,i)=>({line,index:i,priority:/(EN CURSO|NO EVALUABLE|no promov|sin entrenamiento|no equivale|memoria|siguiente pregunta|última completada|no se)/i.test(line)?1:0})).sort((a,b)=>b.priority-a.priority||a.index-b.index);
 return ranked.slice(0,3).sort((a,b)=>a.index-b.index).map(x=>x.line.slice(0,1400));
}
export async function runLearningCycle(previous:LearningState,docs:Knowledge[],options:{date?:string;question?:string;version?:string}={}){
 const at=options.date||new Date().toISOString(),version=options.version||SPIRAL_VERSION;
 const learning=learningSchema.parse(previous);
 if(learning.cycles.length>=60||learning.sources.length>=92||learning.observations.length>=288)return {learning:{...learning,lastCheck:{date:at,result:'Límite de archivo' as const,reason:'Se conserva el historial. Exporta sus registros antes de ampliar el archivo; no se borran para continuar.'}},changed:false,cycle:null};
 const candidates=await Promise.all(docs.map(async d=>{const hash=await digest(d.text.normalize('NFC').trim());return{doc:d,hash,key:d.id+':'+hash.slice(0,16)};}));
 const available=candidates.filter((d,i)=>!learning.sources.some(s=>s.hash===d.hash)&&candidates.findIndex(other=>other.hash===d.hash)===i);
 const selected=available.slice(0,4),newEvaluation=learning.evaluatedVersion!==version;
 const checks=capabilityTests();
 const failed=checks.filter(c=>!c.passed),newErrors=failed.filter(c=>!learning.negativeMemory.some(m=>m.includes(c.name)));
 if(!selected.length&&!newEvaluation&&!newErrors.length)return {learning:{...learning,lastCheck:{date:at,result:'Sin novedad' as const,reason:'No hay una fuente nueva, un error nuevo ni un cambio de implementación que evaluar. La espiral se pausa sin sumar un ciclo.'}},changed:false,cycle:null};
 const observations=selected.flatMap(({doc,key})=>extractObservations(doc.text).map((text,i)=>({id:key+':'+i,sourceKey:key,title:doc.title,text,label:(doc.kind.includes('aportado')?'Dato aportado':doc.kind.includes('Mandato')?'Mandato recuperado':'Registro histórico') as 'Dato aportado'|'Mandato recuperado'|'Registro histórico',date:doc.date||at,url:doc.url||'#spiral'})));
 const connections:LearningCycle['connections']=[];
 for(const current of observations)for(const old of learning.observations){
  const shared=[...new Set(tokens(current.text))].filter(t=>tokens(old.text).includes(t)&&t.length>4).slice(0,8);
  if(shared.length>=3&&connections.length<12)connections.push({from:old.id,to:current.id,shared,status:'Coincidencia léxica'});
 }
 const revised=selected.filter(s=>learning.sources.some(old=>old.id===s.doc.id&&old.hash!==s.hash));
 const remaining=available.length-selected.length;
 const nextQuestion=remaining?`¿Qué aporta «${available[selected.length].doc.title}» y qué sigue sin estar demostrado?`:newErrors.length?'¿Qué cambio mínimo corrige los errores nuevos sin rebajar el evaluador?':'¿Qué evidencia nueva o contraejemplo permitiría revisar lo aprendido, más allá de repetir este corpus?';
 const number=learning.cycles.length+1;
 const cycle:LearningCycle={id:crypto.randomUUID(),number,date:at,question:options.question?.slice(0,4000)||learning.nextQuestion,
  phases:[
   {name:'Observar',result:`Se leyeron ${selected.length} fuentes nuevas para esta memoria y se calcularon las huellas SHA-256 de su texto normalizado. ${checks.length} pruebas ejecutadas${newEvaluation?' sobre esta versión del método':'; las pruebas ya registradas no se repiten como progreso'}.`},
   {name:'Comprender',result:`Se extrajeron ${observations.length} fragmentos con procedencia. Su etiqueta conserva que son registros o datos aportados; no se presentan como verdades externas.`},
   {name:'Conectar',result:`Se registraron ${connections.length} coincidencias de vocabulario con memoria previa. Son candidatas de conexión; no inferencias causales ni comprensión semántica demostrada.`},
   {name:'Aplicar',result:`Se incorporan ${observations.length} fragmentos recuperables y ${selected.length} versiones de fuente. La memoria anterior permanece disponible.`},
   {name:'Refutar',result:`Pruebas superadas: ${checks.filter(c=>c.passed).length}/${checks.length}${checks.length?'':' (sin evaluación nueva)'}. Versiones distintas de una misma fuente: ${revised.length}. No se resuelve la pregunta histórica Q594 ni se contrasta la verdad del corpus.`},
   {name:'Aprender',result:`Cambio local: ${selected.length} fuentes incorporadas, ${newErrors.length} errores nuevos registrados${newEvaluation?', primera comprobación de esta versión del método':''}. Avance científico y competencia general: no demostrados. Siguiente pregunta conservada para continuar.`}
  ],sourceKeys:selected.map(s=>s.key),observationIds:observations.map(o=>o.id),connections,checks,
  novelty:{evidence:selected.length+(newEvaluation?checks.length:0),newErrors:newErrors.length,resolvedPredictions:0,ruleChanges:0,prunedConnections:0},before:learning.observations.length,after:learning.observations.length+observations.length,nextQuestion,
  frame:{object:'Incorporación y revisión del conocimiento documental de Atlas',environment:'Corpus privado, archivo de investigación y herramientas implementadas',perspective:'Un programa con observación limitada a sus entradas y pruebas',scale:'Documento, versión y ciclo local',elevation:'Λ: el corpus pasa de ambiente a objeto al auditar su procedencia y sus límites.'},
  semiosis:{object:'El contenido y la procedencia de las fuentes',sign:'Texto, fecha, hash y resultados ejecutados',interpretant:'Incorporación al registro; la interpretación no convierte el texto en un hecho'},
  triangle:{center:`Lectura de ${selected.length} fuentes y ejecución de ${checks.length} pruebas.`,animal:'Atención, necesidades y consecuencias humanas de confiar en estas salidas; no sensaciones atribuidas a Atlas.',mind:'Extracción de fragmentos, comparación de huellas, coincidencia de términos y pruebas formales.',event:'Contenido no observado, fuentes faltantes, errores semánticos y resultados aún desconocidos.'},
  tribunal:{facts:[`${selected.length} fuentes leídas y hash calculado.`,`${observations.length} fragmentos añadidos.`,`${checks.filter(c=>c.passed).length} de ${checks.length} pruebas locales superadas.`],inferences:['Estos fragmentos pueden recuperarse después; no garantizan una respuesta correcta.'],hypotheses:['Las coincidencias léxicas pueden orientar una pregunta posterior; necesitan contraste independiente.'],metaphors:['La espiral representa recurrencia con memoria e historia, no una ley física ni conciencia.'],axioms:['No reescribir el pasado.','No modificar el juez para aprobar una propuesta.','No incrementar Q por una ejecución C del programa.'],unknowns:['Verdad externa y vigencia del contenido.','Aprendizaje general del modelo y ejecución del experimento pareado Q594.','Cambios de la conversación original posteriores a la instantánea recuperada.']},
  progress:{scientific:'Ningún descubrimiento científico nuevo demostrado.',technical:`Memoria incorporada y comprobación del método: ${observations.length} fragmentos nuevos; ${newErrors.length} errores nuevos.`,economic:'Sin operaciones, señales ni resultados financieros evaluados. Economía exclusivamente en simulación.'}
 };
 const next:LearningState={...learning,sources:[...learning.sources,...selected.map(({doc,hash,key})=>({key,id:doc.id,title:doc.title,hash,date:doc.date||at,kind:doc.kind,url:doc.url||'#spiral'}))],observations:[...learning.observations,...observations],cycles:[...learning.cycles,cycle],negativeMemory:[...learning.negativeMemory,...newErrors.map(c=>'Fallo medido en '+version+': '+c.name+'; '+c.detail)],evaluatedVersion:version,nextQuestion,lastCheck:{date:at,result:'Aprendizaje registrado',reason:'Novedad local trazable; no se avanza la numeración Q.'}};
 return {learning:learningSchema.parse(next),changed:true,cycle};
}
