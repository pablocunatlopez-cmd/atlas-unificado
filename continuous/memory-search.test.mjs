import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {olderChatMessages} from './chat-history.mjs';

const chatSource=await readFile(new URL('./chat-ui.js',import.meta.url),'utf8');
const start=chatSource.indexOf('const stopwords = new Set(');
const end=chatSource.indexOf('\nfunction buildModelMessages',start);
assert.ok(start>=0&&end>start,'No se encontró el bloque de recuperación de memoria del chat.');
const retrievalSource=`${chatSource.slice(start,end)}\nglobalThis.retrievePersonalMemories=retrievePersonalMemories;`;

function recall(conversations,query,{enabled=true,activeConversationId=null}={}){
 const sandbox={conversations,activeConversationId,history:conversations.find(c=>c.id===activeConversationId)?.messages||[],attachments:[],olderChatMessages,personalMemoryPairCache:new WeakMap(),$:()=>({checked:enabled})};
 vm.runInNewContext(retrievalSource,sandbox);
 return JSON.parse(JSON.stringify(sandbox.retrievePersonalMemories(query)));
}

function conversation(id,title,questions,updatedAt=Date.now()){
 const messages=questions.flatMap(({question,answer})=>[
  {role:'user',content:question},
  {role:'assistant',content:answer}
 ]);
 return{id,title,updatedAt,messages};
}

test('la memoria pondera términos informativos y deja fuera una coincidencia genérica',()=>{
 const records=[
  conversation('refutation','Pruebas Atlas',[{question:'¿Cómo refutar candidatos Q594 sin contaminar el modelo?',answer:'Usa un conjunto reservado, registra contraejemplos y conserva el candidato base.'}]),
  conversation('generic','Notas genéricas',[{question:'¿Cómo se organizan candidatos para un proyecto?',answer:'Define tareas, responsables, fechas y documentación compartida.'}]),
  conversation('unrelated','Receta',[{question:'¿Cómo preparar una tortilla de patatas?',answer:'Cocina la patata y la cebolla antes de añadir el huevo.'}])
 ];
 const result=recall(records,'refutación de candidatos Q594');
 assert.equal(result[0]?.title,'Pruebas Atlas');
 assert.equal(result.some(item=>item.title==='Receta'),false);
});

test('una coincidencia rara puede recuperar un recuerdo breve',()=>{
 const records=Array.from({length:30},(_,index)=>conversation(
  `record-${index}`,
  index===0?'Óptica experimental':`Apunte ${index}`,
  [{question:index===0?'¿Qué mide la refracción del xenón en este ensayo?':`Apunte general número ${index}`,answer:index===0?'El ensayo registra la refracción observada y su incertidumbre.':`Contenido de referencia ${index}`}]
 ));
 const result=recall(records,'xenón procedimiento');
 assert.equal(result[0]?.title,'Óptica experimental');
 assert.equal(recall(records,'xenón')[0]?.title,'Óptica experimental');
});

test('recupera como máximo una pareja por conversación y dos conversaciones',()=>{
 const repeated=conversation('a','Primera',[1,2,3].map(number=>({question:`Refutación control ejemplo ${number}`,answer:`Candidato revisado número ${number}`})));
 const other=conversation('b','Segunda',[{question:'Refutación control con métodos seguros',answer:'El control mantiene los pesos base.'}]);
 const third=conversation('c','Tercera',[{question:'Refutación control con registro de límites',answer:'Conservar falsadores.'}]);
 const result=recall([repeated,other,third],'refutación control');
 assert.equal(result.length,2);
 assert.equal(new Set(result.map(item=>item.title)).size,2);
});

test('no añade recuerdos cuando el usuario desactiva Memoria o pregunta con términos vacíos',()=>{
 const records=[conversation('a','Atlas',[{question:'Refutación del candidato Q594',answer:'Prueba reservada.'}])];
 assert.deepEqual(recall(records,'refutación candidata Q594',{enabled:false}),[]);
 assert.deepEqual(recall(records,'atlas conversación memoria'),[]);
});

test('recupera un acuerdo antiguo del chat activo fuera de la ventana reciente',()=>{
 const records=[conversation('active','Proyecto Zafiro',[
  {question:'El motor del proyecto Zafiro se llama Órbita y usa celdas hexagonales.',answer:'Registrado: motor Órbita para Zafiro, celdas hexagonales.'},
  ...Array.from({length:20},(_,i)=>({question:`Revisión de calendario ${i}`,answer:`Día ${i}, anotado.`}))
 ])];
 const result=recall(records,'¿Qué motor acordamos para Zafiro?',{activeConversationId:'active'});
 assert.equal(result.length,1);assert.match(result[0].answer,/Órbita/);
});

test('no duplica como memoria los turnos recientes del chat activo',()=>{
 const records=[conversation('active','Proyecto Zafiro',[{question:'El motor Zafiro usa celdas hexagonales.',answer:'Motor Zafiro anotado.'}])];
 assert.deepEqual(recall(records,'motor Zafiro',{activeConversationId:'active'}),[]);
});
