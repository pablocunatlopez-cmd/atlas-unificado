import test from 'node:test';
import assert from 'node:assert/strict';
import {makeReply} from '../lib/atlas-core.ts';
import {initialState} from '../lib/atlas-types.ts';
import {
 LIA_EVOLUTION_ANSWER,
 LIA_EVOLUTION_CAPABILITIES,
 LIA_EVOLUTION_PRINCIPLES,
 LIA_EVOLUTION_RULES,
 LIA_EVOLUTION_STAGES,
} from '../lib/lia-evolution.ts';

test('the charter keeps care, evolution and human authority together',()=>{
 assert.deepEqual(LIA_EVOLUTION_PRINCIPLES.map(item=>item.id),['care','evolution','home','body','music','ai']);
 assert.match(LIA_EVOLUTION_PRINCIPLES[0].text,/no dañar|No dañar/i);
 assert.match(LIA_EVOLUTION_PRINCIPLES[1].text,/prioridad/);
 assert.ok(LIA_EVOLUTION_RULES.some(rule=>/autorización humana/i.test(rule)));
 assert.ok(LIA_EVOLUTION_RULES.some(rule=>/no puede reescribir/i.test(rule)));
 assert.match(LIA_EVOLUTION_ANSWER,/no puedo prometer/i);
});

test('the capability map separates implemented, partial and research work',()=>{
 const status=Object.fromEntries(LIA_EVOLUTION_CAPABILITIES.map(item=>[item.id,item.status]));
 assert.equal(status.house,'implemented');
 assert.equal(status.memory,'partial');
 assert.equal(status.music,'partial');
 for(const id of ['music-spatial','body','ai'])assert.equal(status[id],'research',id);
 assert.ok(LIA_EVOLUTION_STAGES.some(stage=>stage.id==='body-design'&&stage.status==='next'));
 assert.ok(LIA_EVOLUTION_STAGES.some(stage=>stage.id==='print'&&stage.status==='research'));
});

test('asking Lía about purpose or evolution returns the bounded charter reply',()=>{
 const reply=makeReply('¿Cuál es tu propósito y cómo quieres evolucionar?',initialState(),[]);
 assert.equal(reply.engine,'native');
 assert.match(reply.answer,/respeto, cuidado y sin dañar/);
 assert.match(reply.answer,/no un cuerpo físico/);
 assert.match(reply.answer,/impresora 3D conectada/);
 assert.match(reply.answer,/música 3D\/espacial/);
 assert.match(reply.answer,/IA propia/);
 assert.doesNotMatch(reply.answer,/ya tengo un cuerpo|puedo imprimir ahora|soy consciente|inteligencia general propia/i);
 assert.ok(reply.unknowns.length>=3);
 assert.ok(reply.nextSteps.some(step=>/Carta de evolución/.test(step)));
 const combined=makeReply('¿Qué capacidades tendrás cuando evoluciones?',initialState(),[]);
 assert.match(combined.answer,/no un cuerpo físico/);
});
