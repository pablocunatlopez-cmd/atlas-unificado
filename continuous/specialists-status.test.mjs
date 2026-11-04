import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpecialistTelemetry,specialistStatusAuthorized} from './specialists-status.mjs';
import {ATLAS_SPECIALISTS,reviewWithSpecialists} from './atlas-specialists.mjs';

const catalog=['memory','retrieval','freshness','citations','security','evaluation','performance','programming','spatial','coordination'].map(id=>({id,name:id}));
const report=()=>({schema:1,kind:'local-deterministic-review',independentModels:false,modelCalls:0,networkCalls:0,elapsedMs:1.25,question:'SECRET-QUESTION',sources:[{excerpt:'SECRET-SOURCE'}],results:catalog.map(item=>({id:item.id,status:'ok',name:'SECRET-LABEL',findings:[{message:'SECRET-FINDING'}],evidence:{path:'SECRET-PATH'}}))});

test('specialist metrics require the owner token and reject an explicit foreign origin',()=>{
 const origin='http://127.0.0.1:8788';
 assert.equal(specialistStatusAuthorized({'x-atlas-token':'owner'},'owner',origin),true);
 assert.equal(specialistStatusAuthorized({'x-atlas-token':'owner',origin},'owner',origin),true);
 for(const headers of [{},{'x-atlas-token':'wrong'},{'x-atlas-token':'owner',origin:'https://other.invalid'}])assert.equal(specialistStatusAuthorized(headers,'owner',origin),false);
 assert.equal(specialistStatusAuthorized({'x-atlas-token':''},'',origin),false);
});

test('the initial inventory is available without inventing any execution',()=>{
 const telemetry=createSpecialistTelemetry({catalog,now:()=>Date.parse('2026-11-04T01:00:00Z')});
 const value=telemetry.status();assert.equal(value.roles.length,10);assert.equal(value.independentModels,0);assert.equal(value.running,false);assert.equal(value.reviews,0);assert.equal(value.checks,0);assert.equal(value.last,null);assert.equal(value.counterScope,'current-coordinator-process');
 assert(value.roles.every(item=>item.runs===0&&item.lastAt===null));
 const copy=telemetry.catalog();copy.roles[0].name='changed';assert.equal(telemetry.catalog().roles[0].name,'memory');
});

test('only actual reports count and closed metrics exclude all source and finding content',()=>{
 let clock=Date.parse('2026-11-04T01:00:00Z');const telemetry=createSpecialistTelemetry({catalog,now:()=>clock});
 assert.equal(telemetry.record(report(),'owner-chat'),true);clock+=1000;
 const second=report();second.results=[{id:'retrieval',status:'attention'},{id:'memory',status:'not-applicable'}];assert.equal(telemetry.record(second,'experience'),true);
 const value=telemetry.status();assert.equal(value.reviews,2);assert.equal(value.checks,12);assert.equal(value.roles.find(item=>item.id==='memory').runs,2);assert.equal(value.last.channel,'experience');assert.equal(value.last.elapsedMs,1.25);assert.equal(value.last.checks,2);
 assert.doesNotMatch(JSON.stringify(value),/SECRET|sources|question|findings|evidence|path/);
 value.last.results[0].status='changed';assert.equal(telemetry.status().last.results[0].status,'attention');
});

test('invalid reports, unknown IDs and duplicate roles cannot manufacture execution counters',()=>{
 const telemetry=createSpecialistTelemetry({catalog});
 for(const value of [null,{}, {...report(),kind:'pretend-model-team'},{...report(),modelCalls:1},{...report(),networkCalls:1},{...report(),independentModels:true},{...report(),results:[{id:'external-secret',status:'ok'}]},{...report(),results:[{id:'memory',status:'pretend-success'}]}])assert.equal(telemetry.record(value),false);
 const duplicated=report();duplicated.results=[{id:'memory',status:'ok'},{id:'memory',status:'ok'}];assert.equal(telemetry.record(duplicated),true);assert.equal(telemetry.status().checks,1);
 assert.equal(telemetry.record(report(),'SECRET-CHANNEL'),false);assert.equal(telemetry.status().reviews,1);
 assert.throws(()=>createSpecialistTelemetry({catalog:catalog.slice(1)}),TypeError);
});

test('the actual ten-specialist report feeds telemetry without turning checks into model or process counts',()=>{
 const telemetry=createSpecialistTelemetry({catalog:ATLAS_SPECIALISTS});
 const reviewed=reviewWithSpecialists({question:'Escena 3D SECRET-QUESTION',sources:[{id:'ficha',excerpt:'SECRET-SOURCE'}],runtime:{concurrency:1,maxInferenceCalls:1}});
 assert.equal(telemetry.record(reviewed,'shared-chat'),true);
 const value=telemetry.status();assert.equal(value.checks,10);assert.equal(value.reviews,1);assert.equal(value.last.channel,'shared-chat');assert.equal(value.independentModels,0);assert.equal(value.running,false);assert.equal(value.extraApiCalls,0);
 assert.doesNotMatch(JSON.stringify(value),/SECRET|findings|excerpt|question/);
});
