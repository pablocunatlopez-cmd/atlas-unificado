import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {LOCAL_RUNTIME_OPTIONS,PROVIDER_ACCESS_OPTIONS,probeLocalRuntimes,inspectConfiguredChatModels,inspectLocalRuntimeInstallations} from './runtime-options.mjs';

const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const absent=()=>{throw Object.assign(Error('private OS error'),{code:'ENOENT'});};
const request=async url=>url.endsWith('/health')?json({status:'ok'}):url.includes(':11434/')?json({models:[{name:'qwen3:4b',size:12345}]}):url.includes('/api/v1/models')?json({models:[{type:'llm',key:'qwen3:4b',loaded_instances:[{id:'qwen3:4b'}]}]}):json({data:[{id:'atlas-local'}]});

test('fixed anonymous GET inventories never generate, redirect, or send credentials',async()=>{
 const calls=[];
 const result=await probeLocalRuntimes({now:()=>Date.parse('2026-11-03T12:00:00Z'),request:async(url,options)=>{
  calls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.deepEqual(options.headers,{Accept:'application/json'});assert.equal(options.body,undefined);return request(url);
 }});
 assert.deepEqual(new Set(calls),new Set(['http://127.0.0.1:11435/health','http://127.0.0.1:11434/api/ps','http://127.0.0.1:1234/api/v1/models',...LOCAL_RUNTIME_OPTIONS.map(runtime=>runtime.url+runtime.inventoryPath)]));
 assert.equal(calls.length,7);assert.equal(result.checkedAt,'2026-11-03T12:00:00.000Z');assert.equal(result.readOnly,true);assert.equal(result.inferenceVerified,false);
 assert.equal(result.runtimes[0].health,'ready');assert.deepEqual(result.runtimes[1].models,[{id:'qwen3:4b',sizeBytes:12345}]);
 assert.deepEqual(result.runtimes[1].loadedModelIds,['qwen3:4b']);assert.equal(result.runtimes[1].loadedInventoryAvailable,true);assert.equal(result.runtimes[3].loadedInventoryAvailable,false);assert.ok(result.runtimes.every(runtime=>runtime.runtimeIdentityVerified===false));
 for(const options of [{url:'http://evil/'},{headers:{Authorization:'private'}},{apiKey:'private'},{runtimes:[]}])await assert.rejects(probeLocalRuntimes(options),error=>error.code==='custom_connection_forbidden');
});

test('health, authentication, inventory and inference availability remain distinct',async()=>{
 const result=await probeLocalRuntimes({request:async url=>url.endsWith('/health')?json({status:'ok'}):new Response('private error',{status:401})});
 assert.equal(result.runtimes[0].health,'ready');
 for(const runtime of result.runtimes){assert.equal(runtime.endpointAvailable,true);assert.equal(runtime.inventoryAvailable,false);assert.equal(runtime.requiresAuthentication,true);assert.equal(runtime.inferenceVerified,false);assert.deepEqual(runtime.models,[]);}
 assert.doesNotMatch(JSON.stringify(result),/private error/);
 const loading=await probeLocalRuntimes({request:async()=>new Response('loading',{status:503})});assert.equal(loading.runtimes[0].health,'not_ready');assert.equal(loading.runtimes[0].inventoryAvailable,false);
});

test('untrusted inventories discard raw fields, paths, duplicate and oversized model entries',async()=>{
 const result=await probeLocalRuntimes({request:async url=>url.endsWith('/health')?json({status:'ok'}):json(url.includes(':11434/')?{models:[{name:'qwen3:4b',size:-1,token:'private-secret'}]}:{data:[{id:'C:\\private\\weights\\Qwen.gguf',secret:'private-secret'},{id:'/home/private/weights/Qwen.gguf'},{id:'https://evil/private'},{id:'sk-private-secret'},{id:'x'.repeat(200)},...Array.from({length:50},(_,i)=>({id:'model-'+i}))]})});
 assert.equal(result.runtimes[0].models.length,32);assert.deepEqual(result.runtimes[0].models[0],{id:'Qwen.gguf'});assert.deepEqual(result.runtimes[1].models,[{id:'qwen3:4b'}]);
 assert.doesNotMatch(JSON.stringify(result),/private|weights|secret|https:\/\/evil/);
});

test('redirects, incorrect content types, HTTP errors and invalid JSON stay sanitized',async()=>{
 for(const [response,reason] of [[()=>new Response(null,{status:302,headers:{Location:'https://evil/private'}}),'redirect_forbidden'],[()=>new Response('private',{headers:{'Content-Type':'text/plain'}}),'unsupported_content_type'],[()=>json({error:'private'}),'invalid_inventory'],[()=>new Response('{private',{headers:{'Content-Type':'application/json'}}),'invalid_json'],[()=>new Response('private',{status:500}),'http_error']]){
  const result=await probeLocalRuntimes({request:async()=>response()});assert.equal(result.runtimes[1].reason,reason);assert.equal(result.runtimes[1].inventoryAvailable,false);assert.doesNotMatch(JSON.stringify(result),/private|evil/);
 }
});

test('body budgets apply both to declared and streamed bytes and cancel readers',async()=>{
 for(const declared of [false,true]){
  let cancelled=0;
  const result=await probeLocalRuntimes({maxBytes:128,request:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(129)));},cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json',...(declared?{'Content-Length':'129'}:{})}})});
  assert.ok(result.runtimes.every(runtime=>runtime.reason==='response_too_large'));assert.equal(cancelled,7);
 }
});

test('one deadline bounds ignored aborts in request adapters and stalled bodies',async()=>{
 for(const body of [false,true]){
  const started=Date.now();let cancelled=0;
  const result=await probeLocalRuntimes({timeoutMs:30,request:async()=>body?new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}}):new Promise(()=>{})});
  assert.ok(Date.now()-started<1000);assert.ok(result.runtimes.every(runtime=>runtime.reason==='timeout'));if(body)assert.equal(cancelled,7);
 }
});

test('caller cancellation prevents network requests and cleans up stalled reads',async()=>{
 const already=new AbortController();already.abort(Error('private cancellation'));let calls=0;
 const before=await probeLocalRuntimes({signal:already.signal,request:async()=>{calls++;return json({});}});assert.equal(calls,0);assert.ok(before.runtimes.every(runtime=>runtime.reason==='cancelled'));
 const controller=new AbortController();let cancelled=0;
 const pending=probeLocalRuntimes({signal:controller.signal,request:async()=>new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}})});
 setTimeout(()=>controller.abort(Error('private cancellation')),10);const during=await pending;assert.equal(cancelled,7);assert.ok(during.runtimes.every(runtime=>runtime.reason==='cancelled'));assert.doesNotMatch(JSON.stringify(during),/private cancellation/);
});

test('downloaded Ollama and LM Studio models never become loaded by inventory membership',async()=>{
 const result=await probeLocalRuntimes({request:async url=>url.endsWith('/health')?json({status:'ok'}):url.endsWith('/api/ps')?json({models:[]}):url.endsWith('/api/v1/models')?json({models:[{type:'llm',key:'downloaded-qwen',loaded_instances:[]},{type:'embedding',loaded_instances:[{id:'embedder'}]},{type:'llm',loaded_instances:[{id:'loaded-qwen'}]}]}):url.endsWith('/api/tags')?json({models:[{name:'downloaded-qwen'}]}):json({data:[{id:'downloaded-qwen'}]})});
 assert.deepEqual(result.runtimes[1].models,[{id:'downloaded-qwen'}]);assert.deepEqual(result.runtimes[1].loadedModelIds,[]);assert.deepEqual(result.runtimes[2].loadedModelIds,['loaded-qwen']);assert.deepEqual(result.runtimes[2].loadedRouteModelIds,['loaded-qwen']);
 const paths=await probeLocalRuntimes({request:async url=>url.endsWith('/health')?json({status:'ok'}):url.includes(':11434/')?json({models:[{name:'private/qwen3:4b'},{name:'loaded-qwen'}]}):json({data:[]})});
 assert.deepEqual(paths.runtimes[1].loadedModelIds,['qwen3:4b','loaded-qwen']);assert.deepEqual(paths.runtimes[1].loadedRouteModelIds,['loaded-qwen']);assert.doesNotMatch(JSON.stringify(paths),/private/);
});

test('configured GGUFs are only statted and public metadata contains no private paths',async()=>{
 const root=path.resolve('runtime-fixture'),reads=[],stats=[];
 const result=await inspectConfiguredChatModels(root,{readText:async(file,limit)=>{reads.push([file,limit]);return file.endsWith('.json')?JSON.stringify({primary:path.resolve('private','Qwen9B.gguf'),fallback:path.resolve('private','Qwen4B.gguf'),apiKey:'private-secret'}):'Qwen9B';},stat:async file=>{stats.push(file);return {isFile:()=>true,size:6169341984};}});
 assert.equal(reads.length,2);assert.deepEqual(reads.map(item=>item[1]),[8192,512]);assert.equal(stats.length,2);assert.equal(result.activeModelReported,'Qwen9B');assert.equal(result.activeModelVerified,false);assert.equal(result.weightIntegrityVerified,false);
 assert.deepEqual(result.weightFiles.map(item=>item.modelName),['Qwen9B.gguf','Qwen4B.gguf']);assert.ok(result.weightFiles.every(item=>item.exists&&item.sizeBytes===6169341984));assert.doesNotMatch(JSON.stringify(result),/private|secret|runtime-fixture/);
});

test('missing or malformed configuration cannot establish model existence or active identity',async()=>{
 const root=path.resolve('fixture');
 const absentResult=await inspectConfiguredChatModels(root,{readText:absent,stat:absent});assert.equal(absentResult.configuration,'defaults');assert.equal(absentResult.activeModelReported,null);assert.ok(absentResult.weightFiles.every(item=>!item.exists&&item.reason==='missing'));
 const oversized=await inspectConfiguredChatModels(root,{readText:async()=> 'x'.repeat(9000),stat:absent});assert.equal(oversized.configuration,'unavailable');assert.equal(oversized.activeModelReported,null);
 let stats=0;const invalid=await inspectConfiguredChatModels(root,{readText:async file=>file.endsWith('.json')?JSON.stringify({primary:'https://evil/model.gguf',fallback:'key.txt'}):'C:\\private\\Qwen',stat:async()=>{stats++;throw Error('unreachable');}});assert.equal(stats,0);assert.ok(invalid.weightFiles.every(item=>item.reason==='invalid_configuration'));
});

test('installation presence is bounded to known paths and never asserts a complete machine scan',async()=>{
 let calls=0;
 const result=await inspectLocalRuntimeInstallations(path.resolve('fixture'),{homeDir:path.resolve('private-home'),localAppData:path.resolve('private-appdata'),stat:async file=>{calls++;if(file.endsWith(path.join('ollama','ollama.exe')))return {isFile:()=>true};return absent();}});
 assert.equal(calls,6);assert.equal(result.find(item=>item.id==='ollama').installationFound,true);assert.ok(result.every(item=>item.installationScope==='known-paths-only'));assert.doesNotMatch(JSON.stringify(result),/private-home|private-appdata|ollama\.exe/);
});

test('provider research reports dated access policies without inventing credentials or free quotas',()=>{
 assert.equal(PROVIDER_ACCESS_OPTIONS.find(item=>item.id==='hugging-face').access,'paid-credits-required');assert.equal(PROVIDER_ACCESS_OPTIONS.find(item=>item.id==='cerebras').access,'expiring-trial');assert.equal(PROVIDER_ACCESS_OPTIONS.find(item=>item.id==='groq').access,'limited-free-plan');
 assert.ok(PROVIDER_ACCESS_OPTIONS.every(item=>item.checkedOn==='2026-11-03'&&item.credentialsVerified===false&&item.quotaVerified===false&&item.documentation.startsWith('https://')));
});
