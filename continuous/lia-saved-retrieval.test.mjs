import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retrieveSavedUserMessages} from '../cloud/lib/core/lia-saved-retrieval.mjs';
test('only retrieves user-authored messages in supplied private threads',()=>{
 const threads=[{id:'a',title:'Música',messages:[{role:'assistant',text:'Guitarra inventada'},{role:'user',text:'Practico guitarra eléctrica'}]},{id:'b',title:'Otros',messages:[{role:'user',text:'Me gusta el campo'}]}];
 const found=retrieveSavedUserMessages('¿Qué dije sobre guitarra?',threads);
 assert.equal(found.length,1);
 assert.match(found[0].excerpt,/Practico guitarra/);
 assert.doesNotMatch(found[0].excerpt,/inventada/);
 assert.deepEqual(retrieveSavedUserMessages('¿Qué dije sobre guitarra?',[]),[]);
 assert.deepEqual(retrieveSavedUserMessages('¿Qué dije?',threads),[]);
});
test('retrieval limits snippets and results',()=>{
 const threads=[{id:'a',title:'a',messages:Array.from({length:20},()=>({role:'user',text:'guitarra '+ 'x'.repeat(2000)}))}];
 const found=retrieveSavedUserMessages('hablamos sobre guitarra',threads);
 assert.ok(found.length<=3);
 assert.ok(found.every(item=>item.excerpt.length<=600));
});
