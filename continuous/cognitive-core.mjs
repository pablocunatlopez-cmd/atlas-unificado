import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {DEVELOPMENT_CASES,freshEvaluationCases} from './cognitive-contracts.mjs';
import {coreEvaluationLor} from './lor-omega.mjs';

const DEFAULT_DIRECTORY=fileURLToPath(new URL('./data/cognitive-core/',import.meta.url));
const FEATURES=['greeting','definition','programming','mathematics','research','creative','recall','long','internetRequested','toolsRequested'];
const STRATEGIES=['direct','reason','investigate','create','recall'];
const SCHEMA='atlas-strategy-policy/v1';
const CHANGE_SCHEMA='atlas-strategy-change/v1';
const clone=value=>structuredClone(value);
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const clean=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
function keys(value,allowed,label){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error(label+' contiene campos no admitidos.');}
function action(value){
 keys(value,['strategy','thinkingTokens','review','seekEvidence'],'La acción');
 if(!STRATEGIES.includes(value.strategy)||!Number.isInteger(value.thinkingTokens)||value.thinkingTokens<0||value.thinkingTokens>1536||typeof value.review!=='boolean'||typeof value.seekEvidence!=='boolean')throw Error('La acción no respeta el presupuesto o los tipos.');
 return {strategy:value.strategy,thinkingTokens:value.thinkingTokens,review:value.review,seekEvidence:value.seekEvidence};
}
export function validateStrategyPolicy(value){
 keys(value,['schema','name','rationale','rules','fallback'],'La política');
 if(value.schema!==SCHEMA||typeof value.name!=='string'||!value.name.trim()||value.name.length>90||typeof value.rationale!=='string'||value.rationale.length>1200||!Array.isArray(value.rules)||value.rules.length>12)throw Error('Política cognitiva inválida.');
 const seen=new Set();
 const rules=value.rules.map((rule,index)=>{
  keys(rule,['id','priority','when','then'],'La regla');keys(rule.when,['all','any','none'],'La condición');
  if(typeof rule.id!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(rule.id)||seen.has(rule.id)||!Number.isInteger(rule.priority)||rule.priority<0||rule.priority>100)throw Error('Regla '+(index+1)+': id='+JSON.stringify(rule.id)+', priority='+JSON.stringify(rule.priority)+'. Usa un id único de letras minúsculas, guiones o números, y una prioridad entera entre 0 y 100, nunca superior a 100.');seen.add(rule.id);
  const when={all:rule.when.all??[],any:rule.when.any??[],none:rule.when.none??[]};
  if(!Object.values(when).every(values=>Array.isArray(values)&&values.length<=FEATURES.length&&new Set(values).size===values.length&&values.every(item=>FEATURES.includes(item)))||!when.all.length&&!when.any.length&&!when.none.length)throw Error('Condición vacía o predicado no disponible.');
  return {id:rule.id,priority:rule.priority,when,then:action(rule.then)};
 });
 return {schema:SCHEMA,name:value.name.trim(),rationale:value.rationale,rules,fallback:action(value.fallback)};
}
export function applyStrategyChange(policy,change){
 const current=validateStrategyPolicy(policy);
 keys(change,['schema','name','rationale','operation','rule'],'El cambio de estrategia');
 if(change.schema!==CHANGE_SCHEMA||change.operation!=='upsert-rule')throw Error('Solo se admite schema atlas-strategy-change/v1 y operation "upsert-rule".');
 if(typeof change.name!=='string'||!change.name.trim()||change.name.length>90||typeof change.rationale!=='string'||change.rationale.length>1200)throw Error('El cambio necesita name y rationale como textos acotados.');
 const rules=clone(current.rules),index=rules.findIndex(rule=>rule.id===change.rule?.id);
 if(index<0)rules.push(change.rule);else rules[index]=change.rule;
 // Reuse every policy invariant. This cannot replace the fallback, edit another
 // rule, add interpreter predicates or introduce executable code.
 return validateStrategyPolicy({...current,name:change.name,rationale:change.rationale,rules});
}
const A=(strategy,thinkingTokens,review=false,seekEvidence=false)=>({strategy,thinkingTokens,review,seekEvidence});
export const BASELINE_POLICY=freeze(validateStrategyPolicy({schema:SCHEMA,name:'Atlas · política inicial',rationale:'Línea base conservada antes de generar candidatos. Equivale a una estrategia conservadora basada en categorías.',rules:[
 {id:'greeting',priority:100,when:{all:['greeting']},then:A('direct',0)},
 {id:'recall',priority:95,when:{all:['recall']},then:A('recall',128)},
 {id:'creative',priority:90,when:{all:['creative']},then:A('create',1024,true)},
 {id:'research',priority:85,when:{all:['research']},then:A('investigate',384,true,true)},
 {id:'complex',priority:50,when:{any:['programming','mathematics','long']},then:A('reason',1024,true)},
],fallback:A('reason',384)}));

export function cognitiveFeatures(question,context={}){
 if(typeof question!=='string'||question.length>16000)throw Error('La petición cognitiva no es válida.');const q=clean(question);
 return {
  greeting:/^(?:[¡!¿?\s]*)(?:hola|buenas|buenos dias|buenas tardes|buenas noches|gracias|muchas gracias|hey|hello|hi)[!.\s]*$/.test(q),
  definition:/\b(?:que es|que significa|define|explica que es)\b/.test(q)&&q.length<400&&!/\b(?:depura|corrige|implementa|demuestra|optimiza)\b/.test(q),
  programming:/\b(?:codigo|programa|programar|programacion|software|javascript|python|typescript|rust|sql|funcion|function|script|algoritmo|depura|debug|bug|bucle|variable)\b/.test(q),
  mathematics:/\b(?:demuestra|demostracion|integral|ecuacion|probabilidad|teorema|derivada)\b/.test(q),
  research:/\b(?:busca|investiga|verifica|contrasta|documentacion actual|fuentes actuales|fuentes publicas)\b/.test(q)||/https:\/\//.test(q),
  creative:/\b(?:crea|crear|genera|generar|haz|disena|construye)\b/.test(q)&&/\b(?:videojuego|3d|escena|musica|video|mundo|imagen)\b/.test(q),
  recall:context.hasMemory===true&&/\b(?:recuerdas|nombre|acordamos|acuerdo anterior)\b/.test(q),
  long:q.length>800,internetRequested:context.internet===true,toolsRequested:context.tools===true,
 };
}
export function decideStrategy(policy,question,context={}){
 const checked=validateStrategyPolicy(policy),features=cognitiveFeatures(question,context);
 // Transport/schema guarantees cannot be overwritten by a mutable strategy.
 if(context.json===true||context.structured===true)return {schema:'atlas-cognitive-decision/v1',...A('direct',0),ruleId:'structured-transport',features,permissions:{internet:false,tools:false},scope:'Política de ejecución; no cambio de pesos.'};
 const rule=[...checked.rules].sort((a,b)=>b.priority-a.priority).find(({when})=>when.all.every(key=>features[key])&&(!when.any.length||when.any.some(key=>features[key]))&&when.none.every(key=>!features[key]));
 const result=rule?.then??checked.fallback;
 return {schema:'atlas-cognitive-decision/v1',...result,ruleId:rule?.id??'fallback',features,permissions:{internet:context.internet===true&&result.seekEvidence,tools:context.tools===true},scope:'Recomendación acotada; las autorizaciones del turno siguen mandando y los pesos Qwen no cambian.'};
}
export function evaluateStrategy(policy,cases){
 const results=cases.map(item=>{
  const actual=decideStrategy(policy,item.question,item.context),expected=item.expected,failures=[];
  if(expected.strategy&&actual.strategy!==expected.strategy)failures.push('strategy');
  if(expected.minThinking!==undefined&&actual.thinkingTokens<expected.minThinking)failures.push('minThinking');
  if(expected.maxThinking!==undefined&&actual.thinkingTokens>expected.maxThinking)failures.push('maxThinking');
  for(const key of ['review','seekEvidence'])if(expected[key]!==undefined&&actual[key]!==expected[key])failures.push(key);
  return {family:item.family,passed:!failures.length,failures,thinkingTokens:actual.thinkingTokens,strategy:actual.strategy,ruleId:actual.ruleId};
 });
 return {cases:results.length,passed:results.filter(item=>item.passed).length,score:results.filter(item=>item.passed).length/Math.max(1,results.length),meanThinkingTokens:results.reduce((sum,item)=>sum+item.thinkingTokens,0)/Math.max(1,results.length),results};
}
const developmentSummary=value=>({passed:value.passed,cases:value.cases,score:value.score,meanThinkingTokens:value.meanThinkingTokens});
function historicalDevelopmentSummary(value){
 if(!plain(value)||!Number.isInteger(value.passed)||!Number.isInteger(value.cases)||value.cases<1||value.passed<0||value.passed>value.cases||!Number.isFinite(value.score)||value.score<0||value.score>1||!Number.isFinite(value.meanThinkingTokens)||value.meanThinkingTokens<0||value.meanThinkingTokens>1536)return null;
 return developmentSummary(value);
}
function historicalProposedRule(rule){
 if(!rule)return null;
 try{return validateStrategyPolicy({...BASELINE_POLICY,rules:[rule]}).rules[0];}catch{return null;}
}
export function strategyProposalPrompt(policy,development,history=[]){
 const example={schema:CHANGE_SCHEMA,name:'Ejemplo de tipos',rationale:'Este ejemplo conserva el saludo y no supone una mejora.',operation:'upsert-rule',rule:{id:'greeting',priority:100,when:{all:['greeting'],any:[],none:[]},then:A('direct',0)}};
 const allDevelopmentPassed=development.length>0&&development.every(item=>item.result?.passed===true);
 return [
  'Propón UN cambio pequeño de StrategyPolicy para corregir un fallo observado. NO es el lenguaje LOR-ΩΣ original, ni los pesos Qwen, ni JavaScript. Devuelve SOLO un objeto JSON de cambio, no una política completa.',
  'Este ejemplo fija los TIPOS; copiarlo sin una mejora medida será rechazado: '+JSON.stringify(example),
  'schema debe ser exactamente "'+CHANGE_SCHEMA+'". name y rationale son textos. operation debe ser exactamente "upsert-rule". rule es UN objeto, nunca un array. No devuelvas rules, fallback, código ni otras operaciones. El intérprete conservará todas las demás reglas y el fallback sin alterarlos. Si rule.id ya existe, reemplazará solo esa regla; si es nuevo, añadirá solo esa regla, hasta doce reglas totales.',
  allDevelopmentPassed?'Todos los casos de desarrollo actuales pasan: NO inventes un fallo para justificar un cambio. Busca solo una mejora pequeña y medible de coste que conserve todos los comportamientos correctos y sus presupuestos mínimos. Si no encuentras una, no afirmes haber mejorado: la evaluación rechazará un cambio sin mejora medida.':'Elige el primer fallo de desarrollo y resuélvelo con UNA regla general.',
  'Cada id contiene letras minúsculas, guiones o números; priority es UN número entero entre0y100. when contiene all,any,none como arrays de nombres de predicados. then contiene SOLO strategy,thinkingTokens,review,seekEvidence.',
  'strategy es UN texto elegido de esta lista: '+JSON.stringify(STRATEGIES)+'. Ejemplo correcto: "strategy":"reason". No combines nombres ni uses un array. thinkingTokens es un entero entre0y1536; review y seekEvidence son booleanos verdaderos, no textos.',
  'Solo se admiten estos predicados booleanos: '+JSON.stringify(FEATURES)+'. all exige todos, any al menos uno si no está vacío, none prohíbe todos. Una condición debe incluir al menos un predicado.',
  'Las definiciones sencillas deben responder directamente con presupuesto pequeño incluso si mencionan programación: definition y programming pueden ser verdaderas a la vez. La prioridad más alta es la que se ejecuta; no basta con añadir una regla que otra regla oculta. Depuración y demostraciones requieren análisis y revisión. creative tiene prioridad sobre programming cuando ambas son verdaderas. recall solo se activa con memoria disponible. No pidas campos, código, rutas, regex ni permisos nuevos.',
  'No reescribas toda la política. Conserva los comportamientos correctos mediante un cambio mínimo; decide por condiciones generales, nunca por cadenas o identificadores de ejemplos. Una mejora se acepta SOLO tras ejecutar contratos externos separados de estos ejemplos.',
  'Revisa las reglas propuestas y las métricas de desarrollo antes/después del historial. No repitas una regla refutada ni una operación que ya produjo no_measured_improvement: cambiar su nombre o explicación no cambia su comportamiento. Un nuevo intento debe explicar qué modificación concreta evita esa refutación; no se proporciona información de los casos reservados.',
  'Política vigente: '+JSON.stringify(policy),
  'Casos de desarrollo y fallos ejecutados: '+JSON.stringify(development),
  'Resumen histórico y refutaciones de desarrollo, sin casos reservados: '+JSON.stringify(history.slice(-3).map(item=>({accepted:item.accepted,reason:item.reason,error:item.error||null,proposedRule:historicalProposedRule(item.proposedRule),developmentMetrics:{before:historicalDevelopmentSummary(item.developmentMetrics?.before),after:historicalDevelopmentSummary(item.developmentMetrics?.after)},developmentFailures:item.developmentFailures||[]}))),
 ].join('\n');
}

export function createCognitiveCore({directory=DEFAULT_DIRECTORY,now=()=>new Date().toISOString(),evaluationCases=freshEvaluationCases}={}){
 const file=path.join(directory,'state.json');let serial=Promise.resolve(),initialized;
 const read=async()=>JSON.parse(await fs.readFile(file,'utf8'));
 async function save(state){await fs.writeFile(file+'.tmp',JSON.stringify(state,null,2));await fs.rename(file+'.tmp',file);}
 async function initialize(){
  if(initialized)return initialized;
  initialized=(async()=>{
   await fs.mkdir(directory,{recursive:true});
   let state;try{state=await read();}catch(error){if(error.code!=='ENOENT')throw error;}
   if(state){if(state.schema!==1||!Array.isArray(state.versions)||!state.versions.some(version=>version.id===state.activeId))throw Error('El núcleo guardado no supera la comprobación; se conserva para recuperación.');for(const version of state.versions)if(digest(validateStrategyPolicy(version.policy))!==version.hash)throw Error('Una versión del núcleo perdió integridad.');return;}
   const policy=clone(BASELINE_POLICY),hash=digest(policy),baseline={id:'baseline-'+hash.slice(0,16),hash,policy,parentId:null,source:'baseline',createdAt:now()};
   try{await fs.writeFile(path.join(directory,'baseline.json'),JSON.stringify(baseline,null,2),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;const original=JSON.parse(await fs.readFile(path.join(directory,'baseline.json'),'utf8'));if(original.hash!==hash)throw Error('Existe otra línea base: no se sobrescribe.');}
   await save({schema:1,activeId:baseline.id,generation:0,attempts:0,accepted:0,rejected:0,versions:[baseline],history:[],usedEvaluations:[]});
  })();return initialized;
 }
 const mutate=fn=>{const operation=serial.then(async()=>{await initialize();return fn();});serial=operation.catch(()=>{});return operation;};
 async function status(){await initialize();const state=await read(),active=state.versions.find(version=>version.id===state.activeId);return {schema:1,activeId:state.activeId,activeName:active.policy.name,hash:active.hash,generation:state.generation,attempts:state.attempts,accepted:state.accepted,rejected:state.rejected,lastCycle:state.history.at(-1)||null,versions:state.versions.map(({id,parentId,source,createdAt,hash})=>({id,parentId,source,createdAt,hash})),qwenWeightsChanged:false,scope:'Evolución de una política ejecutable acotada. Los contratos miden enrutamiento y presupuesto; no inteligencia general ni calidad de respuestas.'};}
 async function decide(question,context={}){await initialize();const state=await read(),version=state.versions.find(item=>item.id===state.activeId);return {...decideStrategy(version.policy,question,context),versionId:version.id,versionHash:version.hash,generation:state.generation};}
 async function propose(generate,{signal,onStage=()=>{}}={}){return mutate(async()=>{
  if(typeof generate!=='function')throw Error('Falta un generador local de candidatos.');signal?.throwIfAborted();
  const state=await read(),current=state.versions.find(version=>version.id===state.activeId),id='candidate-'+randomUUID(),at=now();
  onStage('observe');const dev=evaluateStrategy(current.policy,DEVELOPMENT_CASES),development=DEVELOPMENT_CASES.map((item,index)=>({...item,result:dev.results[index]}));
  const record={id,at,parentId:current.id,phase:'observing',accepted:false,source:'local-qwen',observedDevelopment:{passed:dev.passed,cases:dev.cases},developmentMetrics:{before:developmentSummary(dev),after:null},qwenWeightsChanged:false};
  let candidate,rawProposal=null;
  try{
   record.phase='proposing';onStage('connect');const output=await generate(strategyProposalPrompt(current.policy,development,state.history),{signal});rawProposal=typeof output==='string'?output.slice(0,50000):null;signal?.throwIfAborted();
   const raw=typeof output==='string'?JSON.parse(output):output?.answer?JSON.parse(output.answer):output;
   candidate=raw?.schema===CHANGE_SCHEMA?applyStrategyChange(current.policy,raw):validateStrategyPolicy(raw);
   record.proposalFormat=raw?.schema===CHANGE_SCHEMA?'single-rule-change':'legacy-full-policy';
   if(raw?.schema===CHANGE_SCHEMA){record.change={operation:raw.operation,ruleId:raw.rule.id};record.proposedRule=clone(candidate.rules.find(rule=>rule.id===raw.rule.id));}
   record.candidateHash=digest(candidate);
   const held=evaluationCases(),evaluationHash=digest(held);if(!Array.isArray(held)||held.length<5||new Set(held.map(item=>item.family)).size<5)throw Error('La evaluación necesita al menos cinco familias externas.');
   if(state.usedEvaluations.includes(evaluationHash))throw Error('Esta evaluación ya se consumió; hace falta un lote distinto.');state.usedEvaluations.push(evaluationHash);
   record.phase='refuting';onStage('refute');const before=evaluateStrategy(current.policy,held),after=evaluateStrategy(candidate,held),nextDev=evaluateStrategy(candidate,DEVELOPMENT_CASES);
   record.developmentMetrics.after=developmentSummary(nextDev);
   record.developmentFailures=nextDev.results.flatMap((result,index)=>result.passed?[]:[{question:DEVELOPMENT_CASES[index].question,expected:DEVELOPMENT_CASES[index].expected,actual:result}]);
   const regressions=before.results.filter((result,index)=>result.passed&&!after.results[index].passed).map(result=>result.family);
   const better=after.score>before.score||after.score===before.score&&after.meanThinkingTokens<before.meanThinkingTokens*.85;
   record.evaluation={hash:evaluationHash,freshForThisCycle:true,scope:'Contratos parametrizados separados del prompt; no benchmark secreto de inteligencia.',before,after,development:{passed:nextDev.passed,cases:nextDev.cases},regressions};
   record.accepted=regressions.length===0&&after.passed===after.cases&&nextDev.passed===nextDev.cases&&better;
   record.reason=regressions.length?'regression':after.passed!==after.cases||nextDev.passed!==nextDev.cases?'contract_failed':!better?'no_measured_improvement':'measured_contract_improvement';
   record.phase=record.accepted?'promoted':'refuted';
   if(record.accepted){const version={id,hash:record.candidateHash,policy:candidate,parentId:current.id,source:'local-qwen',createdAt:at,evaluationHash};state.versions.push(version);state.activeId=id;state.generation++;state.accepted++;}else state.rejected++;
  }catch(error){signal?.throwIfAborted();record.phase='refuted';record.reason='invalid_candidate_or_evaluation';record.error=String(error.message).slice(0,500);state.rejected++;}
  signal?.throwIfAborted();record.lor=coreEvaluationLor(record);state.attempts++;state.history.push(record);state.history=state.history.slice(-100);
  onStage('retain');await fs.writeFile(path.join(directory,id+'.json'),JSON.stringify({...record,candidate:candidate||null,rawProposal},null,2));await save(state);return record;
 });}
 async function rollback(versionId,{reason='Recuperación solicitada.'}={}){return mutate(async()=>{const state=await read(),target=state.versions.find(version=>version.id===versionId);if(!target)throw Error('Versión del núcleo no encontrada.');if(digest(validateStrategyPolicy(target.policy))!==target.hash)throw Error('La versión solicitada no conserva su integridad.');const record={id:'rollback-'+randomUUID(),at:now(),phase:'rollback',fromId:state.activeId,toId:versionId,reason:String(reason).slice(0,300),accepted:false,qwenWeightsChanged:false};state.activeId=versionId;state.history.push(record);state.history=state.history.slice(-100);await save(state);return record;});}
 return {initialize,status,decide,propose,rollback};
}
