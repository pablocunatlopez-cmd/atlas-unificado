import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudBridge,publicBridgeCapabilities} from './atlas-cloud-bridge.mjs';
const token='a'.repeat(64),siteUrl='https://atlas.example/';

test('self-review enqueues a real coordinator action and publishes only measured public counters',async()=>{
 for(const accepted of [true,false]){
  const actions=[],local=[];
  const request=async(url,options={})=>{
   if(url===siteUrl+'api/cloud/bridge'){const input=JSON.parse(options.body);actions.push(input);return Response.json(input.action==='claim'?{job:{id:'job-review',leaseToken:'lease',kind:'review',messages:[{role:'user',content:'Mejórate'}]}}:{ok:true});}
   local.push(url);
   if(url.endsWith('/chat/health'))return Response.json({ready:true});
   if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="aa">');
   if(url.endsWith('/autonomy/run')){assert.equal(options.headers['X-Atlas-Token'],'aa');return Response.json({queued:accepted});}
   if(url.endsWith('/process/status'))return Response.json({experience:{enabled:true,experiences:12,learningChanges:1,objective:{kind:'open-inquiry',focus:'suceso',taskId:null,question:'private hypothesis'}}});
   return Response.json({ready:false});
  };
  assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,accepted?'completed':'failed');
  assert.equal(local.filter(url=>url.endsWith('/autonomy/run')).length,1);assert.equal(local.some(url=>/\/stop|\/chat\/message/.test(url)),false);
  const done=actions.find(item=>item.action==='complete');
  if(accepted){assert.match(done.result.answer,/12 experiencias y 1 cambio aceptado/);assert.match(done.result.answer,/no significa que ya haya mejorado/);assert.doesNotMatch(JSON.stringify(done),/private hypothesis/);}else assert.equal(done,undefined);
 }
});
test('outbound bridge gives cloud only safe result and forces local shared privacy mode',async()=>{
 const requests=[],actions=[];
 const request=async(url,options={})=>{
  requests.push({url,options});
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return {ok:true,json:async()=>({ready:true,modelName:'Qwen GPU'})};
  if(url===siteUrl+'api/cloud/bridge'){
   const input=JSON.parse(options.body);actions.push(input);
   return {ok:true,json:async()=>input.action==='claim'?{job:{id:'job-1',leaseToken:'lease-1',messages:[{role:'user',content:'Hola'}],internet:false}}:{ok:true}};
  }
  if(url.endsWith('/chat/'))return {ok:true,text:async()=>'<meta name="atlas-token" content="bbcc">'};
  return {ok:true,json:async()=>({answer:'Hola',model:'atlas-local',modelName:'Qwen',sources:[{private:'hidden'}],secret:'never-upload'})};
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'completed');
 assert.equal(actions[1].action,'complete');assert.deepEqual(actions[1].result,{answer:'Hola',model:'atlas-local',modelName:'Qwen'});
 const local=requests.find(item=>item.url.endsWith('/chat/message'));
 assert.equal(JSON.parse(local.options.body).sharedSession,true);assert.equal(local.options.headers.Authorization,undefined);
 assert.equal(requests.find(item=>item.url.startsWith(siteUrl)).options.redirect,'error');
});
test('offline PC never claims jobs or advertises a model as online',async()=>{
 let cloudCalls=0;const request=async url=>{if(url.startsWith(siteUrl))cloudCalls++;return {ok:true,json:async()=>({ready:false})};};
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'offline');assert.equal(cloudCalls,0);
 for(const address of ['http://example.com/','https://u:p@atlas.example/','https://atlas.example/path'])assert.throws(()=>createCloudBridge({siteUrl:address,token}));
});
test('invalid or failed model responses are never published as completed',async()=>{
 const actions=[];const request=async(url,options={})=>{
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return {ok:true,json:async()=>({ready:true})};
  if(url===siteUrl+'api/cloud/bridge'){const input=JSON.parse(options.body);actions.push(input.action);return {ok:true,json:async()=>input.action==='claim'?{job:{id:'job-1',leaseToken:'lease',messages:[{role:'user',content:'Hola'}]}}:{ok:true}};}
  if(url.endsWith('/chat/'))return {ok:true,text:async()=>'<meta name="atlas-token" content="aa">'};
  return {ok:false,json:async()=>({error:'sensitive filesystem detail'})};
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'failed');assert.deepEqual(actions,['claim','fail']);
});

test('capability telemetry lists real local roles and never exposes model paths or secrets',()=>{
 const result=publicBridgeCapabilities({ready:true,busy:true,models:[{name:'private-name',path:'X:\\secret',downloadedBytes:123,expectedBytes:200}],openfield:{sourceInstalled:true,nativeVideoReady:false,path:'X:\\private'},secret:'private-secret'});
 assert.deepEqual(result,{worlds:true,localRoles:['Arquitecto Qwen','Revisor Qwen'],independentModels:0,video:{ready:true,openfieldInstalled:true,nativeOpenfieldReady:false,provider:'wan21-comfy',downloadedBytes:123,totalBytes:200},gpuMode:'video',processTelemetry:null});
 assert.doesNotMatch(JSON.stringify(result),/private|secret|path/);
 assert.equal(publicBridgeCapabilities({ready:'yes',models:[{downloadedBytes:Infinity,expectedBytes:-1}]}).video.ready,false);
 assert.equal(publicBridgeCapabilities(null).video.totalBytes,0);
 for(const localBase of ['http://example.com/','https://127.0.0.1/','http://127.0.0.1/private','http://u:p@127.0.0.1/'])assert.throws(()=>createCloudBridge({siteUrl,token,localBase}));
});

test('world jobs repair and review actual bounded plans in shared JSON mode',async()=>{
 const plan={title:'Galería',variant:'gallery',lighting:'day',palette:'Azul',objects:[],design:'Un recorrido despejado',code:'never-run',url:'https://evil.example/'};
 const outputs=[{...plan,objects:[{type:'box',position:[0,-100,0],size:[1,1,1],material:0}]},plan,{ok:false,issues:['Necesita un foco'],suggestion:'Añadir luz'}, {...plan,title:'Galería revisada'}];
 const calls=[],actions=[];
 const request=async(url,options={})=>{
  calls.push({url,options});
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return Response.json({ready:true,modelName:'Qwen GPU'});
  if(url.endsWith('/media/status'))return Response.json({ready:false,openfield:{sourceInstalled:true},models:[],path:'private'});
  if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="aa">');
  if(url.endsWith('/chat/message'))return Response.json({answer:JSON.stringify(outputs.shift()),model:'atlas-local',sources:[{private:'do-not-upload'}]});
  const input=JSON.parse(options.body);actions.push(input);
  return Response.json(input.action==='claim'?{job:{id:'job-world',kind:'world',question:'Crea una galería 3D',leaseToken:'lease',messages:[{role:'user',content:'Otra conversación anterior'},{role:'user',content:'Crea una galería 3D'}]}}:{ok:true});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'completed');
 const completed=actions.find(input=>input.action==='complete');
 assert.equal(completed.result.creative.plan.title,'Galería revisada');assert.equal(completed.result.creative.review.attempts,2);assert.equal(completed.result.creative.review.revised,true);
 assert.equal(completed.result.creative.plan.code,undefined);assert.equal(completed.result.creative.plan.url,undefined);
 assert.doesNotMatch(JSON.stringify(completed),/never-run|evil\.example|do-not-upload/);
 const prompts=calls.filter(call=>call.url.endsWith('/chat/message'));
 assert.equal(prompts.length,4);
 for(const prompt of prompts){
  const body=JSON.parse(prompt.options.body);assert.equal(body.sharedSession,true);assert.equal(body.json,true);assert.equal(body.creativeMode,'world');assert.equal(body.tools,false);assert.equal(body.external,false);assert.equal(body.internet,false);assert.equal(body.messages.length,1);assert.equal(prompt.options.headers.Authorization,undefined);assert.equal(prompt.options.headers['X-Atlas-Token'],'aa');
  assert.doesNotMatch(JSON.stringify(body),/Otra conversación anterior/);
 }
 assert.match(JSON.parse(prompts[1].options.body).messages[0].content,/validador externo/);
});

test('local busy retry is bounded by cancellation and never publishes a partial response',async()=>{
 const controller=new AbortController(),actions=[];let attempts=0;
 const request=async(url,options={})=>{
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return Response.json({ready:true});
  if(url.endsWith('/media/status'))return Response.json({ready:false});
  if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="bb">');
  if(url.endsWith('/chat/message')){attempts++;return new Response('',{status:429});}
  const input=JSON.parse(options.body);actions.push(input.action);return Response.json(input.action==='claim'?{job:{id:'job-retry',leaseToken:'lease',messages:[{role:'user',content:'Hola'}]}}:{ok:true});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request,signal:controller.signal,sleep:async()=>controller.abort()}).tick()).status,'failed');
 assert.equal(attempts,1);assert.deepEqual(actions,['claim']);
});

const videoJobId='job-'+ 'd'.repeat(64),videoId='video-1793448000000-abc123de';
const mp4=()=>{const bytes=new Uint8Array(64);bytes.set([0,0,0,32,102,116,121,112,105,115,111,109]);return bytes;};
test('video dispatch streams progress, keeps heartbeats during GPU work, and uploads only the generated MP4',async()=>{
 const actions=[],calls=[];let generating=false;
 const request=async(url,options={})=>{
  calls.push({url,options});
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return Response.json({ready:!generating,modelName:'Qwen GPU'});
  if(url.endsWith('/media/status'))return Response.json({ready:true,busy:generating,models:[{expectedBytes:1000,downloadedBytes:1000}],openfield:{sourceInstalled:true,nativeVideoReady:false},privatePath:'X:\\secret'});
  if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="cc">');
  if(url.endsWith('/media/generate')){
   generating=true;
   return new Response(new ReadableStream({start(output){
    output.enqueue(new TextEncoder().encode(JSON.stringify({type:'progress',stage:'sampling',progress:45})+'\n'));
    setTimeout(()=>{generating=false;output.enqueue(new TextEncoder().encode(JSON.stringify({type:'result',id:videoId,provider:'wan21-comfy',private:'do-not-upload'})+'\n'));output.close();},70);
   }}));
  }
  if(url.includes('/media/artifact?'))return new Response(mp4(),{headers:{'Content-Type':'video/mp4','Content-Length':'64'}});
  if(url===siteUrl+'api/cloud/artifacts/'+videoJobId)return Response.json({ok:true});
  const input=JSON.parse(options.body);actions.push(input);
  return Response.json(input.action==='claim'?{job:{id:videoJobId,kind:'video',leaseToken:'video-lease',messages:[{role:'user',content:'Una ciudad nocturna'}],parameters:{frames:17,steps:5,width:99999,url:'https://evil.example/model',file:'X:\\private'}}}:{continue:true});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request,heartbeatMs:12}).tick()).status,'completed');
 const generation=calls.find(call=>call.url.endsWith('/media/generate'));
 assert.deepEqual(JSON.parse(generation.options.body),{prompt:'Una ciudad nocturna',parameters:{frames:17,width:480,height:272,steps:5,fps:8}});
 assert.equal(generation.options.headers.Authorization,undefined);assert.equal(generation.options.headers.Origin,'http://127.0.0.1:8788');
 const progress=actions.find(input=>input.action==='heartbeat'&&input.progress===45);assert.equal(progress.stage,'sampling');assert.equal(progress.capabilities.gpuMode,'video');
 const upload=calls.find(call=>call.url===siteUrl+'api/cloud/artifacts/'+videoJobId);
 assert.equal(upload.options.redirect,'error');assert.equal(upload.options.headers.Authorization,'Bearer '+token);assert.equal(upload.options.headers['X-Atlas-Lease'],'video-lease');assert.deepEqual(upload.options.body,mp4());
 const result=actions.find(input=>input.action==='complete').result;assert.deepEqual(result.video,{artifactId:videoJobId,provider:'wan21-comfy'});assert.doesNotMatch(JSON.stringify(result),/private|X:|do-not-upload/);
 assert.equal(calls.filter(call=>call.url.endsWith('/chat/message')).length,0);
});

test('cloud cancellation aborts an active video stream before artifact upload or completion',async()=>{
 const actions=[];let localAborted=false;
 const request=async(url,options={})=>{
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return Response.json({ready:true});
  if(url.endsWith('/media/status'))return Response.json({ready:true,busy:true});
  if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="dd">');
  if(url.endsWith('/media/generate'))return new Response(new ReadableStream({start(output){options.signal.addEventListener('abort',()=>{localAborted=true;output.error(options.signal.reason);},{once:true});}}));
  if(url.includes('/artifacts/')||url.includes('/media/artifact?'))assert.fail('Cancellation must not upload an artifact');
  const input=JSON.parse(options.body);actions.push(input.action);return Response.json(input.action==='claim'?{job:{id:videoJobId,kind:'video',leaseToken:'lease',messages:[{role:'user',content:'Un jardín'}]}}:{continue:false});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request,heartbeatMs:10}).tick()).status,'failed');assert.equal(localAborted,true);assert.equal(actions.includes('complete'),false);assert.equal(actions.includes('fail'),true);
});

test('video artifact identifiers cannot request paths or arbitrary files',async()=>{
 const actions=[];
 const request=async(url,options={})=>{
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return Response.json({ready:true});
  if(url.endsWith('/media/status'))return Response.json({ready:true});
  if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="ee">');
  if(url.endsWith('/media/generate'))return new Response(JSON.stringify({type:'result',id:'../../secret',provider:'wan21-comfy'})+'\n');
  if(url.includes('/media/artifact?'))assert.fail('Invalid identifier must not be fetched');
  const input=JSON.parse(options.body);actions.push(input.action);return Response.json(input.action==='claim'?{job:{id:videoJobId,kind:'video',leaseToken:'lease',messages:[{role:'user',content:'Un río'}]}}:{ok:true});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'failed');assert.deepEqual(actions,['claim','fail']);
});

test('the live process endpoint is sanitised before its aggregate state crosses the PC boundary',async()=>{
 const actions=[],calls=[];
 const request=async(url,options={})=>{
  calls.push({url,options});
  if(url.endsWith('/chat/health'))return Response.json({ready:true});
  if(url.endsWith('/media/status'))return Response.json({ready:true});
  if(url.endsWith('/process/status'))return Response.json({at:'2026-10-31T12:00:00Z',processes:[{id:'core',state:'running',phase:'refute',label:'private question',counters:{trials:3,accepted:1,rejected:2},prompt:'private memory'},{id:'unknown',state:'running'}],core:{generation:1,attempts:3,accepted:1,rejected:2,version:'candidate-1',code:'private source'},lor:{verdict:'REFUTED',baseline:.7,score:.6,delta:-.1,negativeControlDelta:0},token:'private-token'});
  assert.equal(url,siteUrl+'api/cloud/bridge');const input=JSON.parse(options.body);actions.push(input);return Response.json({job:null});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'idle');
 const telemetry=actions[0].capabilities.processTelemetry;assert.equal(telemetry.processes.length,1);assert.equal(telemetry.processes[0].label,'Núcleo de estrategias');assert.equal(telemetry.processes[0].state,'running');assert.deepEqual(telemetry.processes[0].counters,{trials:3,accepted:1,rejected:2});
 assert.equal(telemetry.core.qwenWeightsChanged,false);assert.equal(telemetry.lor.verdict,'REFUTED');assert.doesNotMatch(JSON.stringify(actions),/private question|private memory|private source|private-token/);
 for(const call of calls.filter(call=>call.url.includes('127.0.0.1')))assert.equal(call.options.headers?.Authorization,undefined);
});

test('LOR dispatch preserves a refutation and transmits only measured public fields',async()=>{
 const actions=[],localCalls=[];
 const request=async(url,options={})=>{
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return Response.json({ready:true});
  if(url.endsWith('/media/status'))return Response.json({ready:false});
  if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="ee">');
  if(url.endsWith('/lor/experiment')){localCalls.push({url,options});return Response.json({verdict:'REFUTED',baseline:2/3,score:.6,delta:.6-2/3,negativeControlDelta:0,synthetic:true,privatePath:'C:/private',prompt:'private memory',token:'private-token'});}
  if(url.endsWith('/chat/message'))assert.fail('The fixed CPU experiment must not invoke Qwen');
  const input=JSON.parse(options.body);actions.push(input);return Response.json(input.action==='claim'?{job:{id:'job-lor',kind:'lor',leaseToken:'lease',messages:[{role:'user',content:'Run LOR'}]}}:{ok:true});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'completed');assert.equal(localCalls.length,1);assert.deepEqual(JSON.parse(localCalls[0].options.body),{});assert.equal(localCalls[0].options.headers.Origin,'http://127.0.0.1:8788');
 const result=actions.find(input=>input.action==='complete').result;
 assert.deepEqual(result.lor,{verdict:'REFUTED',baseline:2/3,score:.6,delta:.6-2/3,negativeControlDelta:0,synthetic:true});assert.equal(result.model,'atlas-coordinator');assert.doesNotMatch(JSON.stringify(result),/C:\/private|private memory|private-token/);
});

test('cloud cancellation aborts an active CPU LOR experiment without saving a completion',async()=>{
 const actions=[];let localAborted=false;
 const request=async(url,options={})=>{
  if(url.endsWith('/process/status'))return Response.json({processes:[]});
  if(url.endsWith('/chat/health'))return Response.json({ready:true});
  if(url.endsWith('/media/status'))return Response.json({ready:false});
  if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="ee">');
  if(url.endsWith('/lor/experiment'))return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{localAborted=true;reject(options.signal.reason);},{once:true}));
  const input=JSON.parse(options.body);actions.push(input.action);return Response.json(input.action==='claim'?{job:{id:'job-lor',kind:'lor',leaseToken:'lease',messages:[{role:'user',content:'Run LOR'}]}}:{continue:false});
 };
 assert.equal((await createCloudBridge({siteUrl,token,request,heartbeatMs:10}).tick()).status,'failed');assert.equal(localAborted,true);assert.equal(actions.includes('complete'),false);assert.equal(actions.includes('fail'),true);
});

test('an intentional GPU reservation stays visible while Qwen is unloaded and never claims a job',async()=>{
 for(const mode of ['training','video']){
  const actions=[],states=[],localPosts=[];
  const request=async(url,options={})=>{
   if(url.endsWith('/chat/health'))return Response.json({ready:false});
   if(url.endsWith('/media/status'))return Response.json({ready:true,busy:true,gpuMode:mode,models:[],privatePath:'X:/private'});
   if(url.endsWith('/process/status'))return Response.json({at:'2026-11-01T12:00:00Z',processes:[{id:'core',state:'running',phase:'apply',prompt:'private prompt'}],core:{generation:2,attempts:3,accepted:2,rejected:1,version:'measured-v2'}});
   if(url.startsWith('http://127.0.0.1')){localPosts.push(url);assert.fail('No local mutation is needed when no foreground request is queued');}
   assert.equal(url,siteUrl+'api/cloud/bridge');const input=JSON.parse(options.body);actions.push(input);return Response.json({ok:true,queuedCount:0});
  };
  const result=await createCloudBridge({siteUrl,token,request,onState:state=>states.push(state)}).tick();
  assert.equal(result.status,'busy');assert.deepEqual(actions.map(action=>action.action),['heartbeat']);assert.equal(actions[0].capabilities.gpuMode,mode);assert.equal(actions[0].modelName,'Qwen · GPU reservada');assert.equal(actions[0].capabilities.processTelemetry.processes[0].state,'running');assert.equal(actions[0].capabilities.processTelemetry.core.generation,2);
  assert.equal(states.at(-1).status,'gpu_reserved');assert.equal(states.at(-1).mode,mode);assert.equal(localPosts.length,0);assert.doesNotMatch(JSON.stringify(actions),/private prompt|X:\/private/);
 }
});

test('only queued foreground work yields autonomous training, then the next ready tick may claim',async()=>{
 for(const [mode,queuedCount,shouldYield] of [['training',2,true],['training',0,false],['video',2,false],['chat',2,false]]){
  const actions=[],calls=[];let ready=false;
  const request=async(url,options={})=>{
   calls.push({url,options});
   if(url.endsWith('/chat/health'))return Response.json({ready,modelName:'Qwen restored'});
   if(url.endsWith('/media/status'))return Response.json({ready:true,busy:mode!=='chat',gpuMode:mode});
   if(url.endsWith('/process/status'))return Response.json({processes:[]});
   if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="ffaa">');
   if(url.endsWith('/evolution/yield')){ready=true;return Response.json({ok:true});}
   assert.equal(url,siteUrl+'api/cloud/bridge');const input=JSON.parse(options.body);actions.push(input);return Response.json(input.action==='claim'?{job:null}:{ok:true,queuedCount});
  };
  const bridge=createCloudBridge({siteUrl,token,request}),first=await bridge.tick();
  assert.equal(first.status,mode==='chat'?'offline':'busy');assert.equal(actions.some(action=>action.action==='claim'),false);
  const yielding=calls.filter(call=>call.url.endsWith('/evolution/yield'));assert.equal(yielding.length,shouldYield?1:0);
  if(shouldYield){
   const call=yielding[0];assert.equal(call.options.method,'POST');assert.equal(call.options.redirect,'error');assert.equal(call.options.headers['X-Atlas-Token'],'ffaa');assert.equal(call.options.headers.Origin,'http://127.0.0.1:8788');assert.equal(call.options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(call.options.body),{});assert.ok(call.options.signal instanceof AbortSignal);
   assert.equal((await bridge.tick()).status,'idle');assert.deepEqual(actions.map(action=>action.action),['heartbeat','claim']);
  }else if(mode==='chat'){
   assert.equal(actions.length,0);assert.equal(calls.some(call=>call.url.endsWith('/chat/')),false);
  }
 }
});
