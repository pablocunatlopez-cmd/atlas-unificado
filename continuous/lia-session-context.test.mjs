import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recallRecentUserTurn} from '../cloud/lib/core/lia-session-context.mjs';
test('Lía recalls only an explicitly provided user turn',()=>{
 const history=[{role:'user',text:'Me gusta la música'},{role:'assistant',text:'Inventado'},{role:'user',text:'Estoy aprendiendo guitarra'}];
 const result=recallRecentUserTurn('¿Qué te dije antes?',history);
 assert.equal(result.found,true);
 assert.match(result.answer,/Estoy aprendiendo guitarra/);
 assert.doesNotMatch(result.answer,/Inventado/);
 assert.equal(recallRecentUserTurn('¿Qué te dije antes?',[]).found,false);
 assert.equal(recallRecentUserTurn('¿Cómo estás?',history),null);
});
test('Lía bounds quoted user input and refuses arbitrary history objects',()=>{
 assert.equal(recallRecentUserTurn('¿Qué te dije antes?',{}),null);
 const result=recallRecentUserTurn('¿Qué te dije antes?',[{role:'user',text:'x'.repeat(10000)}]);
 assert.ok(result.answer.length<1400);
});
