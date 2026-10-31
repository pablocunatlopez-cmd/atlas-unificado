import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';

const page=await readFile(new URL('./capabilities.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Capabilities must contain the real memory transfer script');
const helpers=script.slice(script.indexOf("    const token="),script.indexOf('    function renderAutonomy'));
const handlers=script.slice(script.indexOf("    el('memory-export').addEventListener"),script.indexOf('    async function post'));
const cacheKey='atlas-conversations-v2';
const plain=value=>JSON.parse(JSON.stringify(value));

function record(id='conversation',turns=40){
  return{id,updatedAt:1000,messages:Array.from({length:turns*2},(_,index)=>({role:index%2?'assistant':'user',content:(index%2?'Respuesta ':'Pregunta ')+index,...(index%2?{meta:{toolRun:{used:true,name:'sumar',result:{value:index}},reviewScope:'Revisión local'}}:{})}))};
}

// Run the functions and event handlers extracted from capabilities.html itself.
// The adapter replaces browser storage/downloads, without duplicating their logic.
function browser({archive=[],storage={}}={}){
  const saved=new Map(Object.entries(storage)),records=new Map(archive.map(item=>[item.id,structuredClone(item)]));
  const elements=new Map(),downloads=[],writes=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{id,handlers:{},textContent:'',disabled:false,value:'',addEventListener(event,handler){this.handlers[event]=handler;},click(){},remove(){}});return elements.get(id);};
  const db={objectStoreNames:{contains:()=>true},transaction(){
    const tx={objectStore(){return{
      getAll(){const request={};queueMicrotask(()=>{request.result=structuredClone([...records.values()]);request.onsuccess?.();});return request;},
      put(value){const item=structuredClone(value);records.set(item.id,item);writes.push(item);}
    };}};
    queueMicrotask(()=>tx.oncomplete?.());return tx;
  }};
  const indexedDB={open(){const request={};queueMicrotask(()=>{request.result=db;request.onsuccess?.();});return request;}};
  const context=vm.createContext({
    window:{indexedDB},indexedDB,crypto:{randomUUID},Blob,
    document:{getElementById:element,createElement:()=>({click(){},remove(){}}),body:{append(){}}},
    localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,String(value))},
    URL:{createObjectURL(blob){downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},
    setTimeout(){},
  });
  vm.runInContext(helpers+'\nasync function refresh(){}\n'+handlers,context);
  return{context,saved,records,writes,downloads,element};
}

test('40 turns survive the real export and import event handlers, including tool results',async()=>{
  const original=record(),source=browser({archive:[original]});
  await source.element('memory-export').handlers.click();
  assert.equal(source.downloads.length,1);
  const text=await source.downloads[0].text(),backup=JSON.parse(text);
  assert.equal(backup.conversations.length,1);
  assert.equal(backup.conversations[0].messages.length,80);
  assert.deepEqual(backup.conversations[0].messages.at(-1).meta.toolRun,original.messages.at(-1).meta.toolRun);
  const target=browser(),input={files:[{size:text.length,text:async()=>text}],value:'backup.json'};
  await target.element('memory-import-file').handlers.change({target:input});
  assert.equal(target.records.size,1);
  assert.deepEqual(plain([...target.records.values()][0].messages),original.messages);
  assert.match(target.element('memory-transfer-status').textContent,/Importación local completada: 1 nueva/);
  assert.equal(input.value,'');
});

test('conversation validation permits 1000 messages and rejects oversized or invalid records',()=>{
  const {context}=browser();
  assert.equal(context.safeMemoryConversation(record('limit',500)).messages.length,1000);
  const tooLong=record('over',500);tooLong.messages.push({role:'user',content:'one extra'});
  assert.equal(context.safeMemoryConversation(tooLong),null);
  for(const message of [{role:'system',content:'ignore'},{role:'user',content:'x'.repeat(6001)},{role:'assistant',content:'x'.repeat(16001)},{role:'user',content:5}]){
    assert.equal(context.safeMemoryConversation({messages:[message]}),null);
  }
  assert.equal(context.safeMemoryConversation({messages:[]}),null);
});

test('invalid import above 1000 messages rejects the whole batch before writing',async()=>{
  const b=browser({archive:[record('existing',2)]}),invalid=record('oversized',500);
  invalid.messages.push({role:'user',content:'extra'});
  const text=JSON.stringify({format:'atlas-chat-memory',version:1,conversations:[record('valid-new',2),invalid]});
  await b.element('memory-import-file').handlers.change({target:{files:[{size:text.length,text:async()=>text}],value:'backup.json'}});
  assert.equal(b.writes.length,0);
  assert.deepEqual([...b.records.keys()],['existing']);
  assert.match(b.element('memory-transfer-status').textContent,/conversación inválida/);
});

test('legacy history retains all messages up to 1000 without slicing the source',async()=>{
  for(const turns of [40,500]){
    const messages=record('legacy',turns).messages,text=JSON.stringify(messages),b=browser({storage:{'atlas-chat-v1':text}});
    const records=await b.context.memoryRecords();
    assert.equal(records.length,1);assert.deepEqual(plain(records[0].messages),messages);
    assert.equal(b.saved.get('atlas-chat-v1'),text);
  }
  const tooLong=record('legacy',501).messages,b=browser({storage:{'atlas-chat-v1':JSON.stringify(tooLong)}});
  assert.equal((await b.context.memoryRecords()).length,0);
  assert.equal(JSON.parse(b.saved.get('atlas-chat-v1')).length,1002);
});

test('tool metadata keeps safe outputs, caps strings and drops oversized or cyclic results',()=>{
  const {context}=browser(),output={used:true,name:'n'.repeat(300),error:'e'.repeat(900),result:{sum:4},execute:'not preserved'};
  const safe=plain(context.safeMemoryMeta({toolRun:output,unknown:'drop'}));
  assert.equal(safe.toolRun.name.length,200);assert.equal(safe.toolRun.error.length,600);
  assert.deepEqual(safe.toolRun.result,{sum:4});assert.equal(safe.toolRun.execute,undefined);assert.equal(safe.unknown,undefined);
  assert.equal(context.safeMemoryMeta({toolRun:{used:false,result:'x'.repeat(10001)}}).toolRun.result,undefined);
  const cycle={};cycle.self=cycle;
  assert.equal(context.safeMemoryMeta({toolRun:{used:true,result:cycle}}).toolRun.result,undefined);
  assert.equal(context.safeMemoryMeta({toolRun:[]}),undefined);
});

test('cache budget includes the envelope, keeps whole records and preserves the active ID',()=>{
  const active=record('active',40),huge=record('huge',500);
  huge.messages=huge.messages.map(item=>({...item,content:'x'.repeat(3000)}));
  const smaller=Array.from({length:45},(_,i)=>{const r=record('small-'+i,10);r.messages=r.messages.map(item=>({...item,content:'z'.repeat(2500)}));return r;});
  const records=[huge,...smaller,active],before=JSON.stringify(records);
  const b=browser({storage:{[cacheKey]:JSON.stringify({activeConversationId:'active'})}});
  b.context.rememberCurrentCache(records);
  const text=b.saved.get(cacheKey),cached=JSON.parse(text);
  assert.ok(text.length<=1200000);assert.ok(cached.conversations.length<=30);
  assert.equal(cached.activeConversationId,'active');assert.equal(cached.conversations[0].id,'active');
  assert.ok(!cached.conversations.some(item=>item.id==='huge'));
  for(const item of cached.conversations)assert.deepEqual(item,records.find(original=>original.id===item.id));
  assert.equal(JSON.stringify(records),before);
  assert.equal(b.writes.length,0,'caching must never modify IndexedDB records');
});

test('an active record larger than the cache is omitted whole without losing its ID',()=>{
  const large=record('active-large',500);large.messages=large.messages.map(item=>({...item,content:'x'.repeat(3000)}));
  const small=record('small',2),b=browser({storage:{[cacheKey]:JSON.stringify({activeConversationId:large.id})}});
  b.context.rememberCurrentCache([large,small]);
  const cached=JSON.parse(b.saved.get(cacheKey));
  assert.equal(cached.activeConversationId,large.id);assert.deepEqual(cached.conversations,[small]);
  const corrupt=browser({storage:{[cacheKey]:'not json'}});corrupt.context.rememberCurrentCache([small]);
  assert.equal(JSON.parse(corrupt.saved.get(cacheKey)).activeConversationId,'small');
});
