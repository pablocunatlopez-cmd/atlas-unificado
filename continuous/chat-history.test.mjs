import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChatHistory,selectChatWindow,olderChatMessages,buildChatContext} from './chat-history.mjs';
const turns=count=>Array.from({length:count},(_,n)=>[{role:'user',content:'pregunta '+n},{role:'assistant',content:'respuesta '+n}]).flat();
test('el archivo conserva cuarenta turnos al guardar, reabrir y continuar',()=>{
 const archive=normalizeChatHistory(turns(40));
 const reopened=normalizeChatHistory(JSON.parse(JSON.stringify(archive)));
 const pending=[...reopened,{role:'user',content:'pregunta nueva'}];
 const window=selectChatWindow(pending);
 assert.equal(window.length,15);assert.equal(reopened.length,80);
 const saved=normalizeChatHistory([...pending,{role:'assistant',content:'respuesta nueva'}]);
 assert.equal(saved.length,82);assert.equal(saved[0].content,'pregunta 0');
 assert.equal(olderChatMessages(pending).length,66);
});
test('recorta contexto por turnos enteros y conserva la última pregunta',()=>{
 const messages=[...turns(20),{role:'user',content:'actual'}];
 const selected=selectChatWindow(messages,{maxMessages:6,maxCharacters:60});
 assert.ok(selected.length<=6);assert.equal(selected[0].role,'user');
 assert.equal(selected.at(-1).content,'actual');
 assert.ok(selected.reduce((sum,m)=>sum+m.content.length,0)<=60);
 selected.forEach((m,i)=>assert.equal(m.role,i%2?'assistant':'user'));
 assert.equal(selectChatWindow(messages,{maxCharacters:3}).length,1);
});
test('un límite de archivo no deja una respuesta huérfana ni muta el original',()=>{
 const messages=turns(30),copy=JSON.stringify(messages);
 const saved=normalizeChatHistory(messages,{maxMessages:9});
 assert.equal(saved.length,8);assert.equal(saved[0].role,'user');
 assert.equal(JSON.stringify(messages),copy);
});
test('la memoria y la ventana reciente comparten presupuesto sin cortar parejas',()=>{
 const messages=[...turns(20),{role:'user',content:'¿Qué acordamos?'}];
 const memories=[{title:'Atlas',question:'Motor antiguo Zafiro',answer:'El objetivo era conservar los contratos.'}];
 const context=buildChatContext(messages,memories,{maxCharacters:700,maxMessages:15});
 assert.match(context.at(-3).content,/Motor antiguo Zafiro/);
 assert.equal(context.at(-1).content,'¿Qué acordamos?');
 assert.ok(context.reduce((sum,m)=>sum+m.content.length,0)<=700);
 context.forEach((m,i)=>assert.equal(m.role,i%2?'assistant':'user'));
});
test('si no cabe memoria, conserva la pregunta actual y no añade recuerdos parciales',()=>{
 const context=buildChatContext([{role:'user',content:'pregunta'}],[{title:'Tema',question:'detalle',answer:'detalle'}],{maxCharacters:20});
 assert.deepEqual(context,[{role:'user',content:'pregunta'}]);
});
test('normalizar conserva solo metadatos saneados y descarta entradas vacías',()=>{
 const result=normalizeChatHistory([{role:'user',content:'hola'},{role:'assistant',content:'bien',meta:{modelName:'Qwen',secret:'hidden'}},{role:'user',content:' '}],{cleanMeta:m=>({modelName:m.modelName})});
 assert.deepEqual(result[1].meta,{modelName:'Qwen'});assert.equal(result.length,2);
});
