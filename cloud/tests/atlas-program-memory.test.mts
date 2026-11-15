import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialWorld,rememberWorldProgram,WORLD_ENTITIES} from '../lib/evolution/world.ts';
test('program project receipts preserve personality, questions, source evidence and visual history',()=>{
 const before=initialWorld(),actor=WORLD_ENTITIES.find(e=>e.kind==='resident'&&e.module==='programming')!;
 before.memories[actor.id].conclusion='Memoria documental anterior';before.memories[actor.id].sourceIds=['source-1'];
 const trial={id:'trial-1',taskId:'positive-total',actorId:actor.id,actorName:actor.name,room:actor.room,at:'2026-11-12T00:00:00Z',status:'completed',decision:'installed',creator:'qwen',reason:'first',scope:'bounded',before:null,seed:1,artifactId:'program-1'} as const;
 const after=rememberWorldProgram(before,trial,'run-1');
 assert.equal(before.memories[actor.id].programming,undefined);
 assert.equal(after.memories[actor.id].question,before.memories[actor.id].question);
 assert.equal(after.memories[actor.id].conclusion,'Memoria documental anterior');
 assert.deepEqual(after.memories[actor.id].sourceIds,['source-1']);
 assert.equal(after.memories['module:programming'].programming?.installed,1);
 assert.equal(after.memories['module:programming'].programming?.promotions,0);
 assert.deepEqual(rememberWorldProgram(after,trial,'run-1'),after);
 const affected=Object.keys(before.memories).filter(id=>JSON.stringify(before.memories[id])!==JSON.stringify(after.memories[id]));
 assert.deepEqual(new Set(affected),new Set([actor.id,'room:'+actor.room,'module:programming']));
});
