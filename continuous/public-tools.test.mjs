import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getAutonomousTask} from './autonomy-curriculum.mjs';
import {publicTools,publicToolIntent} from './public-tools.mjs';

function verified(taskId='lor-omega-schema',overrides={}){
 const task=getAutonomousTask(taskId);
 return {id:randomUUID(),at:'2026-11-01T12:00:00Z',origin:'autonomous-local-programming',passed:true,testOrigin:'external-contract',curriculumTaskId:taskId,source:'function transform(input) { return input; }',name:'private name',task:'private prompt',tests:[{input:'private example',expected:'private result'}],acceptanceTests:task.acceptanceTests,acceptanceResults:task.acceptanceTests.map(test=>({...structuredClone(test),actual:structuredClone(test.expected),passed:true})),privatePath:'C:/private',notes:'private reflection',...overrides};
}

test('a verified public LOR tool exposes only its source and canonical curriculum catalogue',()=>{
 const record=verified(),task=getAutonomousTask('lor-omega-schema'),[tool]=publicTools([record]);
 assert.deepEqual(Object.keys(tool).sort(),['id','source','passed','name','task','tests','curriculumTaskId'].sort());
 assert.equal(tool.id,record.id);assert.equal(tool.source,record.source);assert.equal(tool.passed,true);assert.equal(tool.name,task.name);assert.equal(tool.task,task.task);assert.deepEqual(tool.tests,task.acceptanceTests.slice(0,2));
 assert.doesNotMatch(JSON.stringify(tool),/private name|private prompt|private example|private result|C:\/private|private reflection/);
 tool.tests[0].input.S.E='changed';assert.equal(getAutonomousTask(task.id).acceptanceTests[0].input.S.E,null);assert.equal(record.acceptanceTests[0].input.S.E,null);
});

test('manual, private, unknown or failed tools cannot enter the public pool by cloning names or examples',()=>{
 const cases=[{origin:'manual'},{origin:'private-import'},{curriculumTaskId:'unknown'},{passed:false},{testOrigin:'model-examples'},{id:'C:/private-owner-artifact'},{at:'not-a-date'},{source:''},{source:'x'.repeat(16001)}];
 for(const changes of cases){const record=verified('stable-dedupe',changes);record.name=getAutonomousTask('stable-dedupe').name;record.task=getAutonomousTask('stable-dedupe').task;record.tests=getAutonomousTask('stable-dedupe').acceptanceTests.slice(0,2);assert.deepEqual(publicTools([record]),[]);}
 assert.deepEqual(publicTools(null),[]);
});

test('canonical eight-case contracts and their actual results must all match',()=>{
 const baseline=verified('numeric-statistics'),changedContract=structuredClone(baseline),changedResult=structuredClone(baseline),failed=structuredClone(baseline),incomplete=structuredClone(baseline),extra=structuredClone(baseline);
 changedContract.acceptanceTests[0].expected.sum=999;changedResult.acceptanceResults[0].actual.sum=999;failed.acceptanceResults[5].passed=false;incomplete.acceptanceResults.pop();extra.acceptanceTests.push({input:'private',expected:'private'});
 for(const record of [changedContract,changedResult,failed,incomplete,extra])assert.deepEqual(publicTools([record]),[]);
});

test('only the latest verified version of each canonical task is available',()=>{
 const old=verified('stable-dedupe',{at:'2026-11-01T10:00:00Z'}),newest=verified('stable-dedupe',{at:'2026-11-01T12:00:00Z',origin:'autonomous-local-review'}),other=verified('lor-omega-schema',{at:'2026-11-01T11:00:00Z'}),failedLatest=verified('stable-dedupe',{at:'2026-11-01T13:00:00Z',passed:false});
 assert.deepEqual(publicTools([newest,old,other,failedLatest]).map(tool=>tool.id),[other.id,newest.id]);
});

test('public tool intent requires an appropriate bounded operation and actual input',()=>{
 for(const text of ['Valida LOR-ΩΣ: {"S":{"O":[]}}','Comprueba la estructura S*: {"S":{}}','Quita duplicados de {"values":[1,1,"1"]}','Fusiona intervalos: {"intervals":[[1,2],[2,3]]}','Calcula estadísticas: [10,2,3]','Calcula la mediana de 10, 2, 3','Elimina duplicados: 1, 2, 1','Valida este JSON: {"S":{"O":"texto con } y ["}}'])assert.equal(publicToolIntent(text),true,text);
 for(const text of ['Hola','¿Qué herramientas tienes?','¿Qué capacidades estadísticas tienes para [1,2]?','¿Tienes herramientas para validar {"S":{}}?','¿Puedes calcular estadísticas o validar LOR?','Explícame LOR con {"S":{}}','Investiga los mejores validadores JSON: {"S":{}}','Busca estadísticas de estos valores: [1,2]','Calcula una media','Calcula 42','Calcula lo de 2026-11-01','Valida JSON: {"S":','/atlas estado','Ejecuta PowerShell para calcular [1,2]','Borra archivos duplicados [1,2]','Instala un validador LOR {"S":{}}'])assert.equal(publicToolIntent(text),false,text);
 assert.equal(publicToolIntent(null),false);assert.equal(publicToolIntent('calcula '+ 'x'.repeat(6000)),false);
});
test('new planning and JSON Pointer tools require actual JSON and cannot unlock private actions',()=>{
 for(const question of ['Resuelve JSON Pointer: {"document":{"a":1},"pointer":"/a"}','Consulta el puntero JSON: {"document":[4],"pointer":"/0"}','Planifica las dependencias: {"nodes":["a"],"edges":[]}'])assert.equal(publicToolIntent(question),true,question);
 for(const question of ['¿Qué es JSON Pointer?','Planifica las dependencias del proyecto','¿Qué herramientas tienes para planificar dependencias {"nodes":[]}?','Ejecuta un script que resuelva JSON Pointer {"document":{},"pointer":""}','Instala herramientas de dependencias {"nodes":[]}'])assert.equal(publicToolIntent(question),false,question);
});

test('canonical data tasks can be requested with actual JSON but do not unlock PC commands',()=>{
 assert.equal(publicToolIntent('Aplica este JSON Patch: {"document":{},"patch":[]}'),true);
 assert.equal(publicToolIntent('Lee este CSV: {"text":"a,b"}'),true);
 assert.equal(publicToolIntent('Parsea CSV: {"text":"x;y","delimiter":";"}'),true);
 assert.equal(publicToolIntent('¿Qué es JSON Patch?'),false);
 assert.equal(publicToolIntent('Instala un lector CSV: {"text":"a,b"}'),false);
});
