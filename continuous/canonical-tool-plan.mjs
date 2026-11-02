const KINDS=new Set(['stable-dedupe','numeric-statistics','merge-intervals','json-pointer-resolve','json-patch-apply','csv-parse','dag-dependency-plan','lor-omega-schema']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>Object.hasOwn(value,key);
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const VERBS=/\b(?:deduplica|deduplicar|deduplicate|quita|quitar|elimina|eliminar|calcula|calcular|compute|obten|saca|fusiona|fusionar|une|unir|merge|resuelve|resolver|consulta|consultar|resolve|aplica|aplicar|apply|analiza|analizar|parsea|parsear|parse|convierte|convertir|planifica|planificar|ordena|ordenar|plan|sort|valida|validar|comprueba|comprobar|verifica|verificar|validate)\b/g;
const FORBIDDEN=/\b(?:no|nunca|jamas|tampoco|sin|evita|explica|explicame|explicar|explicacion|describe|describir|escribe|escribir|genera|generar|implementa|implementar|programa|programar|codigo|code|busca|buscar|investiga|investigar|instala|instalar|desinstala|descarga|descargar|reinicia|shutdown|powershell|archivos?|carpetas?|nucleo|pesos|resume|resumir|traduce|traducir|revisa|revisar|mejora|mejorar|compara|comparar|dime|envia|enviar|publica|publicar)\b/;
const patterns={
 'stable-dedupe':/^(?:deduplica|deduplicar|deduplicate)\b|^(?:quita|quitar|elimina|eliminar)\b[\s\S]*\b(?:duplicados?|repetidos?)\b/,
 'numeric-statistics':/^(?:calcula|calcular|compute|obten|saca)\b[\s\S]*\b(?:estadisticas|statistics|media|mediana|promedio|suma|minimo|maximo|mean|median|sum)\b/,
 'merge-intervals':/^(?:fusiona|fusionar|une|unir|merge)\b[\s\S]*\b(?:intervalos?|intervals?)\b/,
 'json-pointer-resolve':/^(?:resuelve|resolver|consulta|consultar|resolve)\b[\s\S]*\b(?:json\s*pointer|puntero\s+json)\b/,
 'json-patch-apply':/^(?:aplica|aplicar|apply)\b[\s\S]*\b(?:json\s*patch|parche\s+json)\b/,
 'csv-parse':/^(?:analiza|analizar|parsea|parsear|parse|convierte|convertir)\b[\s\S]*\bcsv\b/,
 'dag-dependency-plan':/^(?:planifica|planificar|ordena|ordenar|plan|sort)\b[\s\S]*\b(?:dependencias|dependencies|dag|grafo)\b/,
 'lor-omega-schema':/^(?:valida|validar|comprueba|comprobar|verifica|verificar|validate)\b[\s\S]*(?:\b(?:lor|omega|esquema|estructura|schema)\b|\bs\*)/
};

function oneJSON(question){
 const regions=[];let start=-1,quoted=false,escaped=false,stack=[];
 for(let i=0;i<question.length;i++){
  const char=question[i];
  if(start<0){if(char==='}'||char===']')return null;if(char==='{'||char==='['){start=i;stack=[char];quoted=false;escaped=false;}continue;}
  if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
  if(char==='"'){quoted=true;continue;}
  if(char==='{'||char==='['){stack.push(char);if(stack.length>128)return null;}
  else if(char==='}'||char===']'){
   if(stack.pop()!==(char==='}'?'{':'['))return null;
   if(!stack.length){
    let input;try{input=JSON.parse(question.slice(start,i+1));}catch{return null;}
    regions.push({start,end:i+1,input});if(regions.length>1)return null;start=-1;
   }
  }
 }
 if(start>=0||regions.length!==1)return null;
 const region=regions[0];return {input:region.input,outside:question.slice(0,region.start)+' '+question.slice(region.end)};
}

function command(text){
 let value=normalize(text).replace(/```(?:json)?/g,' ').trim().replace(/^[¿?¡!\s]+/,'');
 for(let i=0;i<3;i++){const next=value.replace(/^(?:por favor[,;:]?\s+|puedes[,;:]?\s+|primero\s+)/,'');if(next===value)break;value=next;}
 return value.trim();
}

function shape(taskId,input){
 if(!object(input))return false;
 if(taskId==='stable-dedupe'||taskId==='numeric-statistics')return own(input,'values')&&Array.isArray(input.values);
 if(taskId==='merge-intervals')return own(input,'intervals')&&Array.isArray(input.intervals);
 if(taskId==='json-pointer-resolve')return own(input,'document')&&own(input,'pointer')&&typeof input.pointer==='string';
 if(taskId==='json-patch-apply')return own(input,'document')&&own(input,'patch')&&Array.isArray(input.patch);
 if(taskId==='csv-parse')return own(input,'text')&&typeof input.text==='string';
 if(taskId==='dag-dependency-plan')return own(input,'tasks')&&Array.isArray(input.tasks);
 return taskId==='lor-omega-schema'&&own(input,'S');
}

/** A narrow shortcut for explicit operations on one original JSON input.
 * It never executes, rewrites data, fetches sources or grants PC operations.
 * Ambiguity returns null so the existing planner can ask or reason normally.
 */
export function planCanonicalTools(question,available){
 if(typeof question!=='string'||!question.trim()||question.length>30000||!Array.isArray(available))return null;
 const extracted=oneJSON(question);if(!extracted||!object(extracted.input))return null;
 const text=command(extracted.outside);if(!text||FORBIDDEN.test(text))return null;
 const tools=new Map();
 for(const tool of available)if(object(tool)&&typeof tool.id==='string'&&tool.id.length>0&&tool.id.length<=160&&KINDS.has(tool.curriculumTaskId)&&tool.passed!==false)tools.set(tool.curriculumTaskId,tool);
 const parts=text.split(/\s+(?:y\s+)?(?:despues|luego|a continuacion)\s+/);
 if(parts.length===2){
  const [first,last]=parts.map(part=>part.trim());
  if((first.match(VERBS)||[]).length!==1||(last.match(VERBS)||[]).length!==1||!patterns['stable-dedupe'].test(first)||!patterns['numeric-statistics'].test(last)||!shape('stable-dedupe',extracted.input))return null;
  const dedupe=tools.get('stable-dedupe'),statistics=tools.get('numeric-statistics');
  return dedupe&&statistics?{steps:[{toolId:dedupe.id,input:extracted.input},{toolId:statistics.id,inputFrom:'previous'}]}:null;
 }
 if(parts.length!==1||(text.match(VERBS)||[]).length!==1||/\b(?:y|ademas|tambien|o)\b/.test(text))return null;
 const matches=[...KINDS].filter(taskId=>patterns[taskId].test(text)&&shape(taskId,extracted.input));
 if(matches.length!==1)return null;
 const tool=tools.get(matches[0]);return tool?{toolId:tool.id,input:extracted.input}:null;
}
