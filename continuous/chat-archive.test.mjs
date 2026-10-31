import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeChatHistory} from './chat-history.mjs';
const source=await fs.readFile(new URL('./chat-ui.js',import.meta.url),'utf8');
function block(from,to){const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const code=[block('function loadConversationStore()','function openArchiveDatabase()'),block('function normalizeStoredConversation(item)','async function readArchiveConversations()'),block('function saveConversationCache()','async function persistConversationArchive(')].join('\n');
test('el archivo conserva la evidencia de herramientas al normalizar y reabrir',()=>{
 const context={};vm.createContext(context);vm.runInContext(block('function cleanMeta(meta)','function cleanMessages(messages)'),context);
 const original=[{role:'user',content:'Suma estos valores'},{role:'assistant',content:'Resultado: 7',meta:{toolRun:{used:true,name:'suma',result:{total:7},privateField:'omit'},modelName:'Qwen'}}];
 const saved=normalizeChatHistory(original,{cleanMeta:context.cleanMeta});
 const reopened=normalizeChatHistory(JSON.parse(JSON.stringify(saved)),{cleanMeta:context.cleanMeta});
 assert.equal(reopened[1].meta.toolRun.result.total,7);assert.equal(reopened[1].meta.toolRun.used,true);assert.equal(reopened[1].meta.toolRun.privateField,undefined);
});
const messages=count=>Array.from({length:count},(_,i)=>[{role:'user',content:'pregunta '+i},{role:'assistant',content:'respuesta '+i}]).flat();
function setup(cached,stored){
 const storage=new Map([['atlas-conversations-v2',JSON.stringify(cached)]]),writes=[],renders=[];
 const context={conversations:[],activeConversationId:null,history:[],archiveLoading:false,archiveHydrated:false,memoryArchiveCount:0,archiveMode:'',maxConversations:1000,localCacheLimit:30,conversationStorageKey:'atlas-conversations-v2',legacyHistoryKey:'atlas-chat-v1',
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},cleanMessages:normalizeChatHistory,titleFor:m=>m[0]?.content||'Nuevo',makeId:()=> 'generated',
  readArchiveConversations:async()=>structuredClone(stored),writeArchiveConversations:async(records,deleted)=>writes.push({records,deleted}),updateToggles:()=>{},render:persist=>renders.push(persist)};
 vm.createContext(context);vm.runInContext(code,context);context.loadConversationStore();
 return {context,storage,writes,renders};
}
test('una caché antigua no sustituye el archivo completo al reabrir',async()=>{
 const old={id:'active',updatedAt:10,messages:messages(8)},current={...old,updatedAt:20,messages:messages(40)};
 const {context,writes,renders}=setup({version:2,activeConversationId:'active',conversations:[old]},[current]);
 await context.hydrateConversationArchive();
 assert.equal(context.history.length,80);assert.equal(context.conversations[0].updatedAt,20);
 assert.equal(writes[0].records.length,0);assert.deepEqual(renders,[false]);
});
test('la caché limitada conserva selección y restaura un chat grande desde IndexedDB',async()=>{
 const large={id:'large',updatedAt:30,messages:Array.from({length:70},()=>[{role:'user',content:'x'.repeat(6000)},{role:'assistant',content:'y'.repeat(16000)}]).flat()};
 const {context,storage}=setup({version:2,activeConversationId:'large',conversations:[]},[large]);
 await context.hydrateConversationArchive();
 const cache=JSON.parse(storage.get('atlas-conversations-v2'));
 assert.equal(cache.activeConversationId,'large');assert.equal(cache.conversations.length,0);
 context.loadConversationStore();assert.equal(context.activeConversationId,'large');
 await context.hydrateConversationArchive();assert.equal(context.history.length,140);
});
test('el fallo del archivo deja disponible la copia de caché y termina la restauración',async()=>{
 const old={id:'active',updatedAt:10,messages:messages(10)};
 const {context}=setup({version:2,activeConversationId:'active',conversations:[old]},[]);
 context.readArchiveConversations=async()=>{throw Error('IndexedDB no disponible');};
 assert.equal(await context.hydrateConversationArchive(),false);
 assert.equal(context.history.length,20);assert.equal(context.archiveLoading,false);assert.equal(context.archiveHydrated,true);
});
