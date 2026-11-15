import test from 'node:test';
import assert from 'node:assert/strict';
import {RESIDENT_MEMORY_WINDOW_MS,buildResidentMemoryEvents,isResidentId,residentMemoryEventKey,residentMemorySummary} from './resident-memory.mjs';

const now=Date.UTC(2026,10,15,12,0,0);
const telemetry=(processes,at=now,extra={})=>({at:new Date(at).toISOString(),connected:true,processes,...extra});

test('only fresh terminal outcomes become observations for the responsible station',()=>{
 const apply=buildResidentMemoryEvents(telemetry([{id:'experience',state:'passed',phase:'apply',label:'Contraste'},{id:'tools',state:'failed',phase:'apply',label:'Herramientas'}]),{now});
 assert.deepEqual(apply.map(event=>[event.residentId,event.processId,event.state,event.phase]),[
  ['lab-bench','experience','passed','apply'],
  ['body-console','tools','failed','apply'],
  ['body-arm','tools','failed','apply'],
 ]);
 assert.match(apply[0].text,/Nilo · experimentos observó un resultado reportado del proceso Contraste en la fase Aplicar\./);
 assert.match(apply[1].text,/fallo reportado/);
 const observe=buildResidentMemoryEvents(telemetry([{id:'experience',state:'passed',phase:'observe',label:'Contraste'}]),{now});
 assert.deepEqual(observe.map(event=>[event.residentId,event.processId,event.state,event.phase]),[['mind-desk','experience','passed','observe']]);
 assert.deepEqual(buildResidentMemoryEvents(telemetry([{id:'experience',state:'running',phase:'apply'}]),{now}),[]);
 assert.deepEqual(buildResidentMemoryEvents(telemetry([{id:'experience',state:'passed'}]),{now}),[]);
 assert.deepEqual(buildResidentMemoryEvents(telemetry([{id:'experience',state:'passed',phase:'apply'}],now,{connected:false}),{now}),[]);
 assert.deepEqual(buildResidentMemoryEvents(telemetry([{id:'experience',state:'passed',phase:'apply'}],now-75001),{now}),[]);
 assert.deepEqual(buildResidentMemoryEvents(telemetry([{id:'experience',state:'passed',phase:'apply'}],now+1),{now}),[]);
});

test('event keys are stable inside a time bucket and bounded per observation pass',()=>{
 const process={id:'tools',state:'passed',phase:'apply',label:'Herramientas'};
 const first=buildResidentMemoryEvents(telemetry([process]),{now});
 assert.equal(first[0].id,residentMemoryEventKey({residentId:'body-console',processId:'tools',state:'passed',phase:'apply'},now));
 assert.equal(first[0].id,buildResidentMemoryEvents(telemetry([process],now+RESIDENT_MEMORY_WINDOW_MS-1),{now:now+RESIDENT_MEMORY_WINDOW_MS-1})[0].id);
 assert.notEqual(first[0].id,buildResidentMemoryEvents(telemetry([process],now+RESIDENT_MEMORY_WINDOW_MS),{now:now+RESIDENT_MEMORY_WINDOW_MS})[0].id);
 const many=buildResidentMemoryEvents(telemetry(['experience','tools','research','external','agents','creative','video','review','weights','lor','core','chat'].map(id=>({id,state:'passed',phase:['experience','tools'].includes(id)?'apply':undefined,label:'Proceso '+id}))),{now});
 assert.equal(many.length,12);
 assert.equal(isResidentId('body-console'),true);
 assert.equal(isResidentId('cinema-audience-1'),false);
 assert.equal(isResidentId('unknown'),false);
 assert.equal(residentMemorySummary({state:'passed',phase:'apply'}),'Resultado reportado · Aplicar');
 assert.equal(residentMemorySummary({state:'failed',phase:null}),'Fallo reportado');
});
