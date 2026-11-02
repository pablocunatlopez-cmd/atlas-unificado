import {isDeepStrictEqual} from 'node:util';
import {getAutonomousTask} from './autonomy-curriculum.mjs';

const ORIGINS=new Set(['autonomous-local-programming','autonomous-local-review','coordinator-curriculum-build']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The public catalogue is rebuilt from fixed curriculum descriptions, never
 * from the owner's free-text tool names, examples, tasks or reflection notes.
 * Sources remain server-side and may execute only in the existing pure sandbox.
 */
export function publicTools(records){
 if(!Array.isArray(records))return [];
 const latest=new Map();
 for(const [index,record] of records.entries()){
  if(!record||record.passed!==true||!ORIGINS.has(record.origin)||record.testOrigin!=='external-contract'||!UUID.test(record.id)||typeof record.source!=='string'||!record.source.trim()||record.source.length>16000)continue;
  const task=getAutonomousTask(record.curriculumTaskId),at=Date.parse(record.at);
  if(!task||!Number.isFinite(at)||task.acceptanceTests.length!==8||!isDeepStrictEqual(record.acceptanceTests,task.acceptanceTests)||!Array.isArray(record.acceptanceResults)||record.acceptanceResults.length!==8)continue;
  if(!record.acceptanceResults.every((result,i)=>result?.passed===true&&isDeepStrictEqual(result.input,task.acceptanceTests[i].input)&&isDeepStrictEqual(result.expected,task.acceptanceTests[i].expected)&&isDeepStrictEqual(result.actual,task.acceptanceTests[i].expected)))continue;
  const previous=latest.get(task.id);if(previous&&(previous.at>at||previous.at===at&&previous.index>index))continue;
  latest.set(task.id,{at,index,tool:{id:record.id,source:record.source,passed:true,name:task.name,task:task.task,tests:structuredClone(task.acceptanceTests.slice(0,2)),curriculumTaskId:task.id}});
 }
 return [...latest.values()].sort((a,b)=>a.at-b.at||a.index-b.index).map(item=>item.tool);
}

function hasStructuredInput(text){
 let starts=0;
 for(let start=0;start<text.length&&starts<24;start++){
  if(text[start]!=='{'&&text[start]!=='[')continue;starts++;
  const stack=[];let quoted=false,escaped=false;
  for(let end=start;end<text.length;end++){
   const char=text[end];
   if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
   if(char==='"'){quoted=true;continue;}
   if(char==='{'||char==='[')stack.push(char);
   else if(char==='}'||char===']'){
    if(stack.pop()!==(char==='}'?'{':'['))break;
    if(!stack.length){try{const value=JSON.parse(text.slice(start,end+1));if(value&&typeof value==='object')return true;}catch{}break;}
   }
  }
 }
 return false;
}

/** A narrow intent gate avoids sending ordinary conversation to a tool planner.
 * It does not execute, parse commands, grant Internet or unlock PC operations.
 */
export function publicToolIntent(question){
 if(typeof question!=='string'||!question.trim()||question.length>6000)return false;
 const text=question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(/\b(?:que|cuales)\s+(?:herramientas|capacidades|funciones)\b|\b(?:tienes|cuentas\s+con)\s+(?:la\s+)?(?:capacidad|herramientas)\b/.test(text))return false;
 if(text.startsWith('/')||/\b(?:instala|desinstala|reinicia|shutdown|powershell|cmd\.exe|borra\s+(?:los\s+)?archivos|elimina\s+(?:los\s+)?archivos|ejecuta\s+(?:(?:el|un|este)\s+)?(?:comando|script|python)|abre\s+(?:(?:el|un|mi)\s+)?archivo)\b/.test(text))return false;
 if(/^(?:[¿?\s]*(?:puedes\s+)?)(?:busca|buscar|investiga|investigar|resume|resumir|lee|leer)\b/.test(text)&&!/\bcsv\b/.test(text))return false;
 const compute=/\b(?:calcula|calcular|calcule|compute|estadisticas|media|mediana|promedio|suma|sumar|minimo|maximo)\b/.test(text);
 const dedupe=/\b(?:deduplica|deduplicar|deduplicate|quita\s+duplicados|elimina\s+duplicados|sin\s+duplicados|valores\s+unicos)\b/.test(text);
 const merge=/\b(?:fusiona|fusionar|une|unir|merge)\b/.test(text)&&/\bintervalos?\b/.test(text);
 const validate=/\b(?:valida|validar|validate|comprueba|comprobar|verifica|verificar)\b/.test(text)&&/\b(?:lor|omega|esquema|estructura|json)\b|s\*/.test(text);
 const pointer=/\b(?:resuelve|resolver|resolve|consulta|consultar)\b/.test(text)&&/\b(?:json\s*pointer|puntero\s+json)\b/.test(text);
 const dependencies=/\b(?:planifica|planificar|ordena|ordenar|plan|sort)\b/.test(text)&&/\b(?:dependencias|dependencies|dag|grafo)\b/.test(text);
 const patch=/\b(?:aplica|aplicar|apply|comprueba|verifica|valida)\b/.test(text)&&/\b(?:json\s*patch|parche\s+json)\b/.test(text);
 const csv=/\b(?:analiza|analizar|parsea|parsear|parse|convierte|convertir|lee|leer)\b/.test(text)&&/\bcsv\b/.test(text);
 if(!compute&&!dedupe&&!merge&&!validate&&!pointer&&!dependencies&&!patch&&!csv)return false;
 if(hasStructuredInput(question))return true;
 // Plain numeric lists support small requests such as “mediana de 10, 2, 3”.
 // A lone number, a date or a capabilities question is not an executable input.
 const number='[+-]?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?';
 const separated=new RegExp('(?:^|[^\\p{L}\\p{N}])'+number+'(?:\\s*[,;]\\s*'+number+')+(?:$|[^\\p{L}\\p{N}])','u');
 return (compute||dedupe)&&separated.test(text);
}
