import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {relayAtlas} from './atlas-chat-relay.mjs';
async function fixture(t){const dataRoot=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-relay-'));t.after(()=>fs.rm(dataRoot,{recursive:true,force:true}));return dataRoot;}
test('relays to existing PC service, retains context and makes message retry idempotent',async t=>{
 const dataRoot=await fixture(t);const calls=[];
 const request=async(url,options)=>{calls.push({url,options});if(url.endsWith('/chat/'))return {ok:true,text:async()=>'<meta name="atlas-token" content="aabbcc">'};return {ok:true,json:async()=>({answer:'Respuesta de Qwen',model:'atlas-local',trained:false})};};
 const a=await relayAtlas({message:'Mi motor se llama Zafiro.',messageId:'one',conversationId:'mobile'},{dataRoot,request});assert.equal(a.model,'atlas-local');assert.equal(a.relay.intermediary,'Codex');
 const again=await relayAtlas({message:'Mi motor se llama Zafiro.',messageId:'one',conversationId:'mobile'},{dataRoot,request});assert.equal(again.relay.cached,true);assert.equal(calls.length,2);
 await relayAtlas({message:'¿Cómo se llama mi motor?',messageId:'two',conversationId:'mobile'},{dataRoot,request});
 const body=JSON.parse(calls.at(-1).options.body);assert.equal(body.messages[0].content,'Mi motor se llama Zafiro.');assert.equal(body.external,false);assert.equal(calls.at(-1).url,'http://127.0.0.1:8788/chat/message');
 const stored=await fs.readFile(path.join(dataRoot,'mobile.json'),'utf8');assert.doesNotMatch(stored,/aabbcc/);assert.equal(JSON.parse(stored).messages.length,4);
});
test('failures remain errors and do not persist a successful exchange',async t=>{
 const dataRoot=await fixture(t);
 await assert.rejects(relayAtlas({message:'Hola',conversationId:'bad'},{dataRoot,request:async()=>({ok:false})}),/no está disponible/);
 await assert.rejects(fs.readFile(path.join(dataRoot,'bad.json')),/ENOENT/);
 await assert.rejects(fs.readFile(path.join(dataRoot,'bad.json.lock')),/ENOENT/);
 for(const conversationId of ['../data','a/b','a\\b'])await assert.rejects(relayAtlas({message:'Hola',conversationId},{dataRoot}),/inválido/);
});
test('concurrent messages cannot race the same saved history',async t=>{
 const dataRoot=await fixture(t);let release,entered;const reached=new Promise(resolve=>entered=resolve);
 const request=async url=>{if(url.endsWith('/chat/')){entered();await new Promise(resolve=>release=resolve);return {ok:true,text:async()=>'<meta name="atlas-token" content="aabb">'};}return {ok:true,json:async()=>({answer:'Hola',model:'atlas-local'})};};
 const first=relayAtlas({message:'Hola',conversationId:'same'},{dataRoot,request});await reached;
 await assert.rejects(relayAtlas({message:'Otra',conversationId:'same'},{dataRoot,request}),/ya está atendiendo/);release();await first;
});
test('a confirmed dead process lock can be recovered after interruption',async t=>{
 const dataRoot=await fixture(t);await fs.writeFile(path.join(dataRoot,'stale.json.lock'),JSON.stringify({pid:2147483647}));
 const request=async url=>url.endsWith('/chat/')?{ok:true,text:async()=>'<meta name="atlas-token" content="aabb">'}:{ok:true,json:async()=>({answer:'Recuperado',model:'atlas-local'})};
 assert.equal((await relayAtlas({message:'Hola',conversationId:'stale'},{dataRoot,request})).answer,'Recuperado');
});
