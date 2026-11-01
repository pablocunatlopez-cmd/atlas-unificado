import test from 'node:test';
import assert from 'node:assert/strict';
import {getAutonomousTask} from './autonomy-curriculum.mjs';
import {sanitizeLearningTelemetry} from './learning-telemetry.mjs';
import {sanitizeLearningStatus,LEARNING_CATALOG} from './learning-status.mjs';

const date='2026-11-01T12:00:00.000Z';
function verified(taskId='lor-omega-schema',overrides={}){
 const task=getAutonomousTask(taskId);
 return {id:'01234567-89ab-4cde-8123-456789abcdef',at:date,origin:'autonomous-local-programming',passed:true,testOrigin:'external-contract',curriculumTaskId:taskId,source:'function transform(input){return input;}',name:'private name',task:'private prompt',tests:[{input:'private input',expected:'private result'}],acceptanceTests:task.acceptanceTests,acceptanceResults:task.acceptanceTests.map(item=>({...structuredClone(item),actual:structuredClone(item.expected),passed:true})),path:'C:/private',memory:'private memory',...overrides};
}

test('builder publishes only canonically approved tool metadata and actual review dates',()=>{
 const tool=verified(),before=structuredClone(tool);
 const result=sanitizeLearningTelemetry({reviewEnabled:true,paused:false,running:true,lastCycleAt:date,nextRun:'2026-11-01T12:05:00Z',pendingTask:{taskId:'json-pointer-resolve',name:'private pending'},tools:[tool],secret:'private key'});
 assert.deepEqual(result.tools,[{taskId:'lor-omega-schema',name:LEARNING_CATALOG['lor-omega-schema'].name,cases:8,passed:8,createdAt:date}]);
 assert.equal(result.approvedTools,1);assert.equal(result.lastCycleAt,date);assert.equal(result.nextRun,'2026-11-01T12:05:00.000Z');
 assert.equal(result.pendingTask.name,getAutonomousTask('json-pointer-resolve').name);
 assert.doesNotMatch(JSON.stringify(result),/private|source|acceptance|C:\//);
 assert.deepEqual(tool,before);
 assert.deepEqual(sanitizeLearningStatus(sanitizeLearningStatus(result)),result);
});

test('builder requires publicTools evidence and does not trust forged summary counts',()=>{
 const badResult=verified();badResult.acceptanceResults[0].passed=false;
 const changedContract=verified();changedContract.acceptanceTests[0].expected.valid=false;
 const records=[verified('lor-omega-schema',{origin:'manual'}),verified('lor-omega-schema',{testOrigin:'model-examples'}),verified('lor-omega-schema',{passed:false}),verified('lor-omega-schema',{at:'not-date'}),verified('lor-omega-schema',{id:'private-file'}),verified('lor-omega-schema',{source:''}),badResult,changedContract,{taskId:'lor-omega-schema',cases:8,passed:8,createdAt:date}];
 const result=sanitizeLearningTelemetry({reviewEnabled:true,tools:records,approvedTools:999});
 assert.deepEqual(result.tools,[]);assert.equal(result.approvedTools,0);
});

test('duplicate versions count as one approval per task and preserve the chosen valid date',()=>{
 const old=verified('stable-dedupe',{at:'2026-11-01T10:00:00Z'}),newest=verified('stable-dedupe',{at:'2026-11-01T12:00:00Z',origin:'autonomous-local-review'}),badLatest=verified('stable-dedupe',{at:'2026-11-01T13:00:00Z',passed:false});
 const result=sanitizeLearningTelemetry({reviewEnabled:true,tools:[newest,old,badLatest,verified()]});
 assert.equal(result.approvedTools,2);
 assert.equal(result.tools.find(tool=>tool.taskId==='stable-dedupe').createdAt,date);
 for(const value of [null,undefined,[],true,'private'])assert.equal(sanitizeLearningTelemetry(value),null);
});

test('portable labels remain aligned with each canonical curriculum without copying its prompts',()=>{
 assert.equal(Object.keys(LEARNING_CATALOG).length,6);
 for(const [id,entry] of Object.entries(LEARNING_CATALOG)){
  const task=getAutonomousTask(id);assert.equal(entry.name,task.name);assert.equal(entry.cases,task.acceptanceTests.length);
 }
});
