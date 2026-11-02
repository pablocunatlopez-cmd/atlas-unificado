import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeLearningStatus,LEARNING_CATALOG} from './learning-status.mjs';

const date='2026-11-01T12:00:00.000Z';
const approved=(taskId='lor-omega-schema',overrides={})=>({taskId,cases:8,passed:8,createdAt:date,...overrides});

test('portable public schema is closed, canonical, bounded and idempotent',()=>{
 const raw={reviewEnabled:true,paused:false,running:true,lastCycleAt:date,nextRun:'2026-11-01T13:00:00+01:00',pendingTask:{taskId:'dag-dependency-plan',name:'private prompt',source:'private code'},tools:[approved('lor-omega-schema',{name:'private name',source:'private code',path:'C:/private',memory:'private memory'})],approvedTools:999,secret:'private token',online:true};
 const result=sanitizeLearningStatus(raw);
 assert.deepEqual(Object.keys(result).sort(),['reviewEnabled','paused','running','lastCycleAt','nextRun','pendingTask','tools','approvedTools'].sort());
 assert.equal(result.running,true);assert.equal(result.approvedTools,1);assert.equal(result.nextRun,date);
 assert.deepEqual(result.pendingTask,{taskId:'dag-dependency-plan',name:LEARNING_CATALOG['dag-dependency-plan'].name,cases:8});
 assert.deepEqual(Object.keys(result.tools[0]).sort(),['taskId','name','cases','passed','createdAt'].sort());
 assert.equal(result.tools[0].name,LEARNING_CATALOG['lor-omega-schema'].name);
 assert.doesNotMatch(JSON.stringify(result),/private|secret|online/);
 assert.deepEqual(sanitizeLearningStatus(JSON.parse(JSON.stringify(result))),result);
});

test('only complete known eight-case approvals with ISO dates enter counts',()=>{
 const tools=[approved('lor-omega-schema'),approved('lor-omega-schema',{createdAt:'2026-11-01T12:05:00Z'}),approved('unknown'),approved('constructor'),approved('toString'),approved('numeric-statistics',{passed:7}),approved('stable-dedupe',{cases:9}),approved('merge-intervals',{createdAt:'2026-02-30T00:00:00Z'}),approved('dag-dependency-plan',{createdAt:'2026-11-01'}),approved('json-pointer-resolve',{createdAt:'2026-11-01T24:00:00Z'})];
 const result=sanitizeLearningStatus({tools});
 assert.equal(result.approvedTools,1);
 assert.equal(result.tools[0].createdAt,'2026-11-01T12:05:00.000Z');
 assert.equal(sanitizeLearningStatus({tools:Object.keys(LEARNING_CATALOG).flatMap(taskId=>Array.from({length:12},()=>approved(taskId)))}).approvedTools,Object.keys(LEARNING_CATALOG).length);
});

test('pause and disable override running without inventing connectivity or a schedule',()=>{
 const paused=sanitizeLearningStatus({reviewEnabled:true,paused:true,running:true,lastCycleAt:'invalid',nextRun:'invalid',pendingTask:{taskId:'unknown'}});
 assert.equal(paused.running,false);assert.equal(paused.lastCycleAt,null);assert.equal(paused.nextRun,null);assert.equal(paused.pendingTask,null);
 const disabled=sanitizeLearningStatus({reviewEnabled:false,running:true,nextRun:date,pendingTask:{taskId:'lor-omega-schema'}});
 assert.equal(disabled.running,false);assert.equal(disabled.nextRun,null);assert.equal(disabled.pendingTask,null);
 for(const value of [null,undefined,[],true,'private'])assert.equal(sanitizeLearningStatus(value),null);
});
