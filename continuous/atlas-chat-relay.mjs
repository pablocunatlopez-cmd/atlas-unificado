// A transparent bridge from this Codex chat to the user's existing local Atlas.
// Does not expose ports, replace Codex's model, or invoke a paid model provider.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {selectChatWindow} from './chat-history.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const BASE='http://127.0.0.1:8788';
const DEFAULT_CONVERSATION='mobile';
async function acquireRelayLock(lockPath){
 for(let attempt=0;attempt<2;attempt++){
  let handle;
  try{handle=await fs.open(lockPath,'wx');await handle.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));return handle;}
  catch(error){
   if(handle){await handle.close();await fs.rm(lockPath,{force:true});throw error;}
   if(error.code!=='EEXIST')throw error;
   let owner;try{owner=JSON.parse(await fs.readFile(lockPath,'utf8'));}catch{throw Error('Bloqueo del puente pendiente de revisión.');}
   if(!Number.isInteger(owner.pid)||owner.pid<=0)throw Error('Bloqueo del puente inválido.');
   let active=true;try{process.kill(owner.pid,0);}catch(problem){if(problem.code==='ESRCH')active=false;}
   if(active)throw Error('El puente ya está atendiendo un mensaje. Espera a que termine.');
   await fs.rm(lockPath,{force:true});
  }
 }
 throw Error('No se pudo reservar el puente.');
}

export async function relayAtlas(input,{request=fetch,dataRoot=path.join(ROOT,'data','chat-relay')}={}){
 if(!input||typeof input.message!=='string'||!input.message.trim()||input.message.length>6000)throw Error('El mensaje debe tener entre 1 y 6000 caracteres.');
 const conversationId=input.conversationId??DEFAULT_CONVERSATION;
 if(typeof conversationId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(conversationId))throw Error('Identificador de conversación inválido.');
 const messageId=input.messageId??randomUUID();
 if(typeof messageId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(messageId))throw Error('Identificador de mensaje inválido.');
 await fs.mkdir(dataRoot,{recursive:true});
 const file=path.join(dataRoot,conversationId+'.json'),lockPath=file+'.lock';
 const lock=await acquireRelayLock(lockPath);
 try{
  let archive={schema:1,conversationId,messages:[],responses:[]};
  try{archive=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const previous=archive.responses?.find(item=>item.messageId===messageId);
  if(previous)return {...previous.result,relay:{conversationId,cached:true,intermediary:'Codex',local:true}};
  const signal=AbortSignal.timeout(540000);
  const page=await request(BASE+'/chat/',{signal});if(!page.ok)throw Error('Atlas no está disponible en el PC.');
  const token=/name="atlas-token" content="([a-f0-9]+)"/.exec(await page.text())?.[1];
  if(!token)throw Error('No se pudo autenticar el puente local.');
  const messages=[...archive.messages,{role:'user',content:input.message.trim()}];
  const response=await request(BASE+'/chat/message',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Atlas-Token':token,Origin:BASE},body:JSON.stringify({messages:selectChatWindow(messages,{maxMessages:15,maxCharacters:10000}),internet:input.internet===true,tools:input.tools!==false,external:false,refute:input.refute===true})});
  const result=await response.json();
  if(!response.ok||typeof result.answer!=='string'||!result.answer.trim())throw Error(result.error||'Atlas no devolvió una respuesta válida.');
  if(!['atlas-local','atlas-coordinator'].includes(result.model))throw Error('El puente recibió un motor inesperado.');
  const at=new Date().toISOString();
  archive.messages=[...messages,{role:'assistant',content:result.answer}].slice(-1000);
  archive.responses=[...(archive.responses||[]),{messageId,at,result}].slice(-20);archive.updatedAt=at;
  const temporary=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temporary,JSON.stringify(archive,null,2)+'\n');await fs.rename(temporary,file);
  return {...result,relay:{conversationId,cached:false,intermediary:'Codex',local:true,at}};
 }finally{await lock.close();await fs.rm(lockPath,{force:true});}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const index=process.argv.indexOf('--message-file');
  if(index<0||!process.argv[index+1])throw Error('Uso: node atlas-chat-relay.mjs --message-file <archivo JSON>');
  const input=JSON.parse(await fs.readFile(path.resolve(process.argv[index+1]),'utf8'));
  console.log(JSON.stringify(await relayAtlas(input)));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
