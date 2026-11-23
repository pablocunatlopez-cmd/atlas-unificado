// Exercise the actual client effects and authenticated GET route without a DOM,
// audio engine or model. This verifies selection, not browser appearance.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {Script} from 'node:vm';import {createRequire} from 'node:module';import ts from 'typescript';
const nodeRequire=createRequire(import.meta.url),id='11111111-1111-4111-8111-111111111111';
const creation={id,kind:'music',prompt:'Un motivo tranquilo.',model:'openai/gpt-oss-120b',at:'2026-11-15T10:00:00Z',content:{title:'Tema enlazado'}};
const compile=(path:string)=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const libraryCode=compile('../app/creation-library.tsx'),routeCode=compile('../app/api/create-ai/route.ts');
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function library({search='?room=music&creation='+id,kind='music',ready=true,disabled=false,response=creation,status=200,late=false}:{search?:string;kind?:string;ready?:boolean;disabled?:boolean;response?:unknown;status?:number;late?:boolean}={}){
 const effects:Array<()=>void|(()=>void)>=[],cleanups:Array<()=>void>=[],opened:unknown[]=[],updates:Array<{index:number;value:unknown}>=[],calls:Array<{url:string;init:RequestInit}>=[];let slot=0,deliver:((value:Response)=>void)|undefined;
 const react={useState(initial:unknown){const index=slot++;return[initial,(value:unknown)=>updates.push({index,value})];},useRef:(value:unknown)=>({current:value}),useEffect:(fn:()=>void|(()=>void))=>effects.push(fn)};
 const exports:Record<string,unknown>={},fetcher=(async(url:RequestInfo|URL,init:RequestInit={})=>{calls.push({url:String(url),init});if(late)return new Promise<Response>(resolve=>deliver=resolve);return Response.json({creation:response},{status});}) as typeof fetch;
 new Script(libraryCode).runInNewContext({exports,require:(name:string)=>name==='react'?react:name==='react/jsx-runtime'?nodeRequire(name):name==='./creation-library.module.css'?{default:{}}:(()=>{throw Error(name);})(),location:{search},URLSearchParams,AbortController,AbortSignal,fetch:fetcher,console});
 (exports.default as Function)({kind,ready,disabled,onOpen:(value:unknown)=>opened.push(value)});
 for(const effect of effects){const cleanup=effect();if(typeof cleanup==='function')cleanups.push(cleanup);}await flush();await flush();
 return{opened,updates,calls,cleanup:()=>cleanups.forEach(fn=>fn()),deliver:()=>deliver?.(Response.json({creation:response},{status})),flush};
}

test('a valid deep link loads exactly one owner endpoint and selects without playback or model calls',async()=>{
 const f=await library();try{assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/create-ai?id='+id+'&kind=music');assert.equal(f.calls[0].init.method,undefined);assert.equal(f.calls[0].init.credentials,'same-origin');assert.equal(f.calls[0].init.cache,'no-store');assert.equal(f.opened.length,1);assert.equal((f.opened[0] as typeof creation).id,id);assert.ok(f.calls.every(call=>!call.url.includes('/cloud/')&&!call.init.body));}finally{f.cleanup();}
});
test('wrong room, malformed UUID, absent session and an occupied workshop do not start automatic selection',async()=>{
 for(const options of [{search:'?room=cinema&creation='+id},{search:'?room=music&creation='+'-'.repeat(36)},{ready:false},{disabled:true}]){const f=await library(options);assert.equal(f.calls.length,0);assert.equal(f.opened.length,0);f.cleanup();}
});
test('responses must match both the requested creation and workshop; errors preserve the current composition',async()=>{
 for(const options of [{response:{...creation,id:'22222222-2222-4222-8222-222222222222'}},{response:{...creation,kind:'video'}},{status:404}]){const f=await library(options);assert.equal(f.opened.length,0);assert.ok(f.updates.some(update=>update.index===4&&typeof update.value==='string'&&update.value.length>0));f.cleanup();}
});
test('a response arriving after the workshop closes cannot replace its composition',async()=>{
 const f=await library({late:true});assert.equal(f.calls.length,1);f.cleanup();f.deliver();await f.flush();await f.flush();assert.equal(f.opened.length,0);
});

function route({signedIn=true,item=creation}:{signedIn?:boolean;item?:unknown}={}){
 const reads:Array<{userId:string;creationId:string}>=[],lists:unknown[]=[],exports:Record<string,unknown>={};
 const modules:Record<string,unknown>={
  '@/app/chatgpt-auth':{getChatGPTUser:async()=>signedIn?{userId:'alice'}:null},
  '@/lib/server-state':{allowedOrigin:()=>true},
  '@/lib/cloud/http':{body:async()=>({}),cloudJson:(value:unknown,status=200)=>Response.json(value,{status}),cloudError:()=>Response.json({error:'unexpected'},{status:500})},
  '@/lib/creation/server':{createAI:async()=>{throw Error('GET must not create');},listAICreations:async(...args:unknown[])=>{lists.push(args);return[];},getAICreation:async(userId:string,creationId:string)=>{reads.push({userId,creationId});return item;}},
  '@/lib/cloud/queue.mjs':{CloudQueueError:class extends Error{}}
 };
 new Script(routeCode).runInNewContext({exports,require:(name:string)=>{assert.ok(name in modules,name);return modules[name];},URL,Response});
 return{get:(query:string)=>(exports.GET as (r:Request)=>Promise<Response>)(new Request('https://atlas.invalid/api/create-ai'+query)),reads,lists};
}
test('the ID endpoint uses the signed-in owner and rejects absent sessions or invalid selectors before reading',async()=>{
 const f=route();assert.equal((await f.get('?id='+id+'&kind=music')).status,200);assert.deepEqual(f.reads,[{userId:'alice',creationId:id}]);assert.equal(f.lists.length,0);
 for(const query of ['?id='+id+'&kind=invalid','?id='+'-'.repeat(36),'?id=']){const bad=route();assert.equal((await bad.get(query)).status,400);assert.equal(bad.reads.length,0);}
 const signedOut=route({signedIn:false});assert.equal((await signedOut.get('?id='+id)).status,401);assert.equal(signedOut.reads.length,0);
});
test('unknown or wrong-kind owner records fail closed instead of selecting another artifact',async()=>{
 const missing=route({item:null});assert.equal((await missing.get('?id='+id+'&kind=music')).status,404);
 const wrongKind=route({item:{...creation,kind:'video'}});assert.equal((await wrongKind.get('?id='+id+'&kind=music')).status,404);
});
