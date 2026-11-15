import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProject} from '../lib/studio/generator.ts';
import {CloudStudioProjectError,createCloudStudioProject} from '../lib/studio/cloud-project-client.ts';
import type {StudioProject} from '../lib/studio/types.ts';

const projectId='11111111-1111-4111-8111-111111111111',jobId='job-'+'a'.repeat(64),requestId='22222222-2222-4222-8222-222222222222';
function saved(mode:'3d'|'game'='3d'):StudioProject{const generated=generateProject('Un espacio luminoso',mode);return{id:projectId,title:generated.brief.title,mode,prompt:generated.brief.prompt,brief:generated.brief,code:generated.code,revision:1,viewingVersion:1,createdAt:'2026-11-15T10:00:00Z',updatedAt:'2026-11-15T10:00:00Z',versions:[{version:1,date:'2026-11-15T10:00:00Z'}]};}
function fixture(responses:Array<{status?:number;body:unknown}>){
 const calls:Array<{url:string;init:RequestInit}>=[];
 const fetcher=(async(url:RequestInfo|URL,init?:RequestInit)=>{calls.push({url:String(url),init:init||{}});const next=responses.shift();assert.ok(next,'Unexpected extra request');return Response.json(next.body,{status:next.status||200});}) as typeof fetch;
 return{calls,fetcher};
}

test('image, 3D and game design use an explicit stable cloud request then open the persisted project',async()=>{
 for(const mode of ['image','3d','game'] as const){
  const output=saved(mode==='game'?'game':'3d'),f=fixture([{status:202,body:{jobId,status:'queued'}},{body:{id:jobId,status:'running',progress:40}},{body:{id:jobId,status:'completed',result:{creative:{projectId}}}},{body:{project:output}}]),signal=new AbortController().signal,jobs:unknown[]=[],waits:unknown[]=[];
  const result=await createCloudStudioProject({prompt:' Un espacio luminoso ',mode,requestId},{signal,fetcher:f.fetcher,onJob:job=>jobs.push(job),pollIntervalMs:17,wait:async(ms,s)=>{waits.push([ms,s]);}});
  assert.deepEqual(result,output);assert.deepEqual(f.calls.map(c=>c.url),['/api/cloud/chat','/api/cloud/jobs/'+jobId,'/api/cloud/jobs/'+jobId,'/api/studio?id='+projectId]);
  assert.deepEqual(JSON.parse(f.calls[0].init.body as string),{message:'Un espacio luminoso',kind:mode==='game'?'game':'world',requestId});assert.equal(f.calls[0].init.method,'POST');assert.deepEqual(f.calls[0].init.headers,{'Content-Type':'application/json'});
  assert.ok(f.calls.every(call=>call.init.signal===signal&&call.init.cache==='no-store'&&call.init.credentials==='same-origin'));assert.deepEqual(waits,[[17,signal]]);assert.deepEqual(jobs,[{id:jobId,status:'queued'},{id:jobId,status:'running',progress:40},{id:jobId,status:'completed'}]);
 }
});
test('failed or cancelled jobs surface their error without fetching or installing any project',async()=>{
 for(const status of ['failed','cancelled'] as const){
  const f=fixture([{status:202,body:{jobId,status:'queued'}},{body:{id:jobId,status,error:'El trabajo se detuvo antes de completarse.',result:{creative:{projectId}}}}]);
  await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:new AbortController().signal,fetcher:f.fetcher}),error=>error instanceof CloudStudioProjectError&&error.code===status&&error.message==='El trabajo se detuvo antes de completarse.');assert.equal(f.calls.length,2);assert.ok(!f.calls.some(c=>c.url.startsWith('/api/studio')));
 }
});
test('an idempotent replay of a terminal request loads its error and preserves the failed or cancelled code',async()=>{
 for(const status of ['failed','cancelled'] as const){
  const f=fixture([{status:202,body:{jobId,status}},{body:{id:jobId,status,error:'Resultado anterior: '+status}}]),jobs:unknown[]=[];
  await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:new AbortController().signal,fetcher:f.fetcher,onJob:job=>jobs.push(job)}),error=>error instanceof CloudStudioProjectError&&error.code===status&&error.message==='Resultado anterior: '+status);
  assert.deepEqual(f.calls.map(call=>call.url),['/api/cloud/chat','/api/cloud/jobs/'+jobId]);assert.deepEqual(jobs,[{id:jobId,status},{id:jobId,status}]);
 }
});
test('HTTP errors retain their useful server message and stop the workflow',async()=>{
 const f=fixture([{status:429,body:{error:'Espera a que se renueve la cuota gratuita.'}}]);
 await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:new AbortController().signal,fetcher:f.fetcher}),error=>error instanceof CloudStudioProjectError&&error.code==='http'&&error.status===429&&error.message==='Espera a que se renueve la cuota gratuita.');assert.equal(f.calls.length,1);
});
test('aborting the default wait cancels further polls and preserves the caller abort reason',async()=>{
 const controller=new AbortController(),reason=new DOMException('Se cerró el taller.','AbortError'),f=fixture([{status:202,body:{jobId,status:'queued'}},{body:{id:jobId,status:'running'}}]);
 await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:controller.signal,fetcher:f.fetcher,pollIntervalMs:60000,onJob:job=>{if(job.status==='running')queueMicrotask(()=>controller.abort(reason));}}),error=>error===reason);assert.equal(f.calls.length,2);
});
test('a signal aborted before creation makes no request',async()=>{
 const controller=new AbortController(),reason=new DOMException('Detenido.','AbortError');controller.abort(reason);const f=fixture([]);
 await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:controller.signal,fetcher:f.fetcher}),error=>error===reason);assert.equal(f.calls.length,0);
});
test('invalid job or artifact identifiers never become arbitrary fetch URLs',async()=>{
 for(const malicious of ['https://outside.test/scene','../other-project','not-a-uuid']){
  const f=fixture([{status:202,body:{jobId,status:'queued'}},{body:{id:jobId,status:'completed',result:{creative:{projectId:malicious}}}}]);
  await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:new AbortController().signal,fetcher:f.fetcher}),error=>error instanceof CloudStudioProjectError&&error.code==='response');assert.equal(f.calls.length,2);
 }
 const badJob=fixture([{status:202,body:{jobId:'https://outside.test/jobs',status:'queued'}}]);await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:new AbortController().signal,fetcher:badJob.fetcher}),error=>error instanceof CloudStudioProjectError&&error.code==='response');assert.equal(badJob.calls.length,1);
});
test('the fetched project must match both its requested identity and creation mode',async()=>{
 for(const project of [{...saved(),id:'33333333-3333-4333-8333-333333333333'},saved('game')]){
  const f=fixture([{status:202,body:{jobId,status:'queued'}},{body:{id:jobId,status:'completed',result:{creative:{projectId}}}},{body:{project}}]);await assert.rejects(createCloudStudioProject({prompt:'Un bosque',mode:'3d',requestId},{signal:new AbortController().signal,fetcher:f.fetcher}),error=>error instanceof CloudStudioProjectError&&error.code==='response');assert.equal(f.calls.at(-1)!.url,'/api/studio?id='+projectId);
 }
});
