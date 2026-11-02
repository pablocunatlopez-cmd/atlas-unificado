import test from 'node:test';
import assert from 'node:assert/strict';
import {planCanonicalTools} from './canonical-tool-plan.mjs';

const ids=['stable-dedupe','numeric-statistics','merge-intervals','json-pointer-resolve','json-patch-apply','csv-parse','dag-dependency-plan','lor-omega-schema'];
const available=ids.map(curriculumTaskId=>({id:'runtime-'+curriculumTaskId,curriculumTaskId,passed:true}));
const expected=(id,input)=>({toolId:'runtime-'+id,input});

test('explicit canonical verbs and types select each of the eight original JSON profiles',()=>{
 const cases=[
  ['Deduplica estos valores:','stable-dedupe',{values:[3,1,3]}],
  ['¿Puedes, calcular las estadísticas de:','numeric-statistics',{values:[10,2,3]}],
  ['Por favor, fusiona estos intervalos:','merge-intervals',{intervals:[[1,3],[2,4]]}],
  ['Resuelve este JSON Pointer:','json-pointer-resolve',{document:{x:3},pointer:'/x'}],
  ['Aplica este JSON Patch:','json-patch-apply',{document:{x:1},patch:[{op:'replace',path:'/x',value:3}]}],
  ['Analiza este CSV:','csv-parse',{text:'a,b\n1,2',delimiter:','}],
  ['Ordena las dependencias de estas tareas:','dag-dependency-plan',{tasks:[{id:'a',dependsOn:[]}]}],
  ['Valida la estructura LOR-ΩΣ:','lor-omega-schema',{S:{O:null}}]
 ];
 for(const [prefix,id,input] of cases){const question=prefix+' '+JSON.stringify(input);assert.deepEqual(planCanonicalTools(question,available),expected(id,input),prefix);}
});

test('courtesy prefixes and accents are normalized without changing any input field',()=>{
 const input={values:[10,2,3],note:'No reescribir información ni campos extra'};
 assert.deepEqual(planCanonicalTools('¿Puedes por favor calcular la mediana? '+JSON.stringify(input),available),expected('numeric-statistics',input));
 assert.deepEqual(planCanonicalTools('Elimina duplicados: '+JSON.stringify({values:[false,0,'0',false]}),available),expected('stable-dedupe',{values:[false,0,'0',false]}));
});

test('strings, escapes and brackets inside JSON do not become extra inputs or action intent',()=>{
 const input={text:'"[un texto]",{"una":"cadena"}\n"comillas ""escapadas""",\\path',note:'calcula estadísticas y aplica JSON Patch a tareas'};
 assert.deepEqual(planCanonicalTools('Analiza CSV: '+JSON.stringify(input),available),expected('csv-parse',input));
 const values={values:['tarea','calcula estadísticas','aplica JSON Patch','no elimina duplicados','[]','{"S":{}}']};
 assert.deepEqual(planCanonicalTools('Deduplica: '+JSON.stringify(values),available),expected('stable-dedupe',values));
 assert.equal(planCanonicalTools('Procesa estos datos '+JSON.stringify({values:[1],note:'calcula estadísticas'}),available),null);
});

test('special own keys and a JSON Pointer input are preserved without prototype pollution or mutation',()=>{
 const literal='{"document":{"__proto__":{"polluted":true},"constructor":7,"":null},"pointer":"/__proto__/polluted"}',question='Resuelve este puntero JSON: '+literal,before=structuredClone(available),result=planCanonicalTools(question,available);
 assert.equal(result.toolId,'runtime-json-pointer-resolve');assert.equal(Object.hasOwn(result.input.document,'__proto__'),true);assert.deepEqual(result.input,JSON.parse(literal));assert.equal({}.polluted,undefined);assert.deepEqual(available,before);
});

test('two JSON inputs, malformed JSON and bare arrays are ambiguous and remain with the model planner',()=>{
 for(const suffix of ['{"values":[1]} {"values":[2]}','{"values":[1]} y después [2,3]','{"values":[1,]}','{"values":[1]','[1,2,1]','{"values":[1]} {broken}','{"values":[1]} ]'])assert.equal(planCanonicalTools('Deduplica: '+suffix,available),null,suffix);
});

test('negations and requests for explanation, code, search, files or installation never become tool execution plans',()=>{
 for(const prefix of ['No deduplica','Nunca elimina duplicados','Explica cómo calcular estadísticas de','Escribe código para fusionar intervalos de','Busca cómo resolver JSON Pointer de','Instala un parser CSV para','Aplica JSON Patch a los archivos usando'])assert.equal(planCanonicalTools(prefix+' '+JSON.stringify({values:[1,1],intervals:[],document:{},pointer:'',patch:[],text:''}),available),null,prefix);
 assert.equal(planCanonicalTools('No hagas nada. Deduplica '+JSON.stringify({values:[1]}),available),null);
});

test('only the explicitly ordered dedupe then statistics composition is admitted',()=>{
 const input={values:[10,2,10,3]},steps=[{toolId:'runtime-stable-dedupe',input},{toolId:'runtime-numeric-statistics',inputFrom:'previous'}];
 for(const prefix of ['Deduplica los valores y después calcula sus estadísticas:','Quita duplicados y luego calcula la mediana:','Primero elimina duplicados; luego calcula la suma:'])assert.deepEqual(planCanonicalTools(prefix+' '+JSON.stringify(input),available),{steps},prefix);
 for(const prefix of ['Deduplica y calcula las estadísticas:','Calcula estadísticas y después elimina duplicados:','Deduplica y después calcula estadísticas y luego fusiona intervalos:','Deduplica y luego escribe código para calcular estadísticas:'])assert.equal(planCanonicalTools(prefix+' '+JSON.stringify(input),available),null,prefix);
});

test('missing capabilities fall back and the latest available record for each canonical task is selected',()=>{
 const question='Calcula las estadísticas: {"values":[1,2]}';assert.equal(planCanonicalTools(question,[]),null);assert.equal(planCanonicalTools(question,[{id:'fake',curriculumTaskId:'custom-stats'}]),null);
 assert.deepEqual(planCanonicalTools(question,[...available,{id:'latest-stats',curriculumTaskId:'numeric-statistics'}]),{toolId:'latest-stats',input:{values:[1,2]}});
 assert.equal(planCanonicalTools('Deduplica y después calcula estadísticas: {"values":[1,2]}',available.filter(tool=>tool.curriculumTaskId!=='numeric-statistics')),null);
});

test('intent must start with the explicit verb and cannot be supplied by keys or string values',()=>{
 for(const prefix of ['Me gustaría saber si puedes calcular estadísticas de','¿Qué herramientas tienes para deduplicar','Hola, deduplica','Aquí está mi tarea:'])assert.equal(planCanonicalTools(prefix+' '+JSON.stringify({values:[1,2],task:'calcula estadísticas',note:'deduplica'}),available),null,prefix);
 assert.equal(planCanonicalTools('Calcula '+JSON.stringify({values:[1],note:'estadísticas'}),available),null);
 assert.equal(planCanonicalTools('Fusiona estos intervalos y calcula estadísticas '+JSON.stringify({intervals:[],values:[]}),available),null);
 assert.equal(planCanonicalTools('Deduplica y resume el resultado '+JSON.stringify({values:[1]}),available),null);
 assert.equal(planCanonicalTools('Deduplica y haz otra tarea '+JSON.stringify({values:[1]}),available),null);
});
