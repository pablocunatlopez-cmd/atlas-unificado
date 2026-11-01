import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {CloudQueueError} from './queue.mjs';
import {byteRange} from './media-range.mjs';

// Execute the actual route with only framework bindings replaced; no server,
// persistent storage, authentication account or Cloudflare service is needed.
const routeFile=fileURLToPath(new URL('../../app/api/cloud/artifacts/[id]/route.ts',import.meta.url));
const compiled=ts.transpileModule(fs.readFileSync(routeFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const id='job-'+'a'.repeat(64),otherId='job-'+'b'.repeat(64),lease=crypto.randomUUID();
function fixture(){
 const state={user:'pablo',owner:'pablo',job:{status:'completed',result:{video:{artifactId:id}}},lease:{kind:'video',status:'running',lease_token:lease,lease_until:Date.now()+300000},size:100,bucketMissing:false,objectMissing:false,events:[],uploads:[]};
 const bucket={
  async head(key){state.events.push(['head',key]);return state.objectMissing?null:{size:state.size};},
  async get(key,options){state.events.push(['get',key,options]);if(state.objectMissing)return null;return {body:new Uint8Array(options?.range?.length??state.size)};},
  async put(key,bytes,options){state.events.push(['put',key]);state.uploads.push({key,bytes,options});},
 };
 const env={get BUCKET(){return state.bucketMissing?undefined:bucket;},DB:{prepare(sql){return {bind(jobId){return {async first(){state.events.push(['lease',jobId]);return state.lease;}};}};}}};
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
 const http={
  async cloudUser(){state.events.push(['auth']);if(!state.user)throw new CloudQueueError('Inicia sesión.',401);return {userId:state.user};},
  async bridgeAuthorized(request){state.events.push(['bridge-auth']);if(request.headers.get('authorization')!=='Bearer test-bridge')throw new CloudQueueError('Puente no autorizado.',401);},
  queue(){return {async getJob(userId,jobId){state.events.push(['job',userId,jobId]);if(userId!==state.owner)throw new CloudQueueError('Solicitud no encontrada.',404);return state.job;}};},
  cloudJson:json,
  cloudError(error){return json({error:error instanceof CloudQueueError?error.message:'Operación no disponible.'},error.status||503);},
 };
 const exports={};
 vm.runInNewContext(compiled,{exports,require(name){if(name==='cloudflare:workers')return {env};if(name==='@/lib/cloud/http')return http;if(name==='@/lib/cloud/media-range.mjs')return {byteRange};throw Error('Unexpected route import: '+name);},Response,TextDecoder,Date},{filename:routeFile});
 return {state,GET:(request=new Request('https://atlas.test/api/cloud/artifacts/'+id),jobId=id)=>exports.GET(request,{params:Promise.resolve({id:jobId})}),POST:(request,jobId=id)=>exports.POST(request,{params:Promise.resolve({id:jobId})})};
}
function upload({headers={},bytes}={}){
 const data=bytes||new Uint8Array(32);if(!bytes)data.set(new TextEncoder().encode('ftyp'),4);
 return new Request('https://atlas.test/api/cloud/artifacts/'+id,{method:'POST',headers:{authorization:'Bearer test-bridge','X-Atlas-Lease':lease,'content-type':'video/mp4','content-length':String(data.byteLength),...headers},body:data});
}
test('artifact reads authenticate first and refuse other users before touching R2',async()=>{
 const {state,GET}=fixture();state.user=null;assert.equal((await GET()).status,401);assert.deepEqual(state.events,[['auth']]);
 state.events.length=0;state.user='otro';assert.equal((await GET()).status,404);assert.deepEqual(state.events,[['auth'],['job','otro',id]]);
 state.events.length=0;state.user='pablo';assert.equal((await GET(undefined,'../private')).status,404);assert.deepEqual(state.events,[['auth']]);
});
test('only the completed owner job can expose its exactly bound video artifact',async()=>{
 for(const job of [null,{status:'running'},{status:'failed'},{status:'completed',result:{}},{status:'completed',result:{video:{artifactId:otherId}}}]){
  const {state,GET}=fixture();state.job=job;assert.equal((await GET()).status,404);assert.equal(state.events.some(event=>event[0]==='head'||event[0]==='get'),false);
 }
 const {state,GET}=fixture();state.bucketMissing=true;assert.equal((await GET()).status,404);state.bucketMissing=false;state.objectMissing=true;assert.equal((await GET()).status,404);assert.equal(state.events.some(event=>event[0]==='get'),false);
});
test('owned videos stream full files or valid bounded ranges with private cache headers',async()=>{
 const {state,GET}=fixture();
 for(const [range,status,length,contentRange] of [[null,200,100,null],['bytes=0-1',206,2,'bytes 0-1/100'],['bytes=20-',206,80,'bytes 20-99/100'],['bytes=-10',206,10,'bytes 90-99/100'],['bytes=95-999',206,5,'bytes 95-99/100']]){
  state.events.length=0;const response=await GET(new Request('https://atlas.test/api/cloud/artifacts/'+id,{headers:range?{range}:{}}));
  assert.equal(response.status,status);assert.equal(response.headers.get('Content-Length'),String(length));assert.equal(response.headers.get('Content-Range'),contentRange);assert.equal(response.headers.get('Accept-Ranges'),'bytes');assert.equal(response.headers.get('Content-Type'),'video/mp4');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal((await response.arrayBuffer()).byteLength,length);
  assert.equal(state.events.find(event=>event[0]==='get')[1],'videos/'+id);
 }
 for(const range of ['bytes=100-','bytes=9-2','bytes=0-1,3-4','bytes=-0']){
  state.events.length=0;const response=await GET(new Request('https://atlas.test/api/cloud/artifacts/'+id,{headers:{range}}));assert.equal(response.status,416);assert.equal(response.headers.get('Content-Range'),'bytes */100');assert.equal(state.events.some(event=>event[0]==='get'),false);
 }
});
test('video uploads require bridge authentication, a running video lease and MP4 metadata',async()=>{
 const noAuth=fixture();assert.equal((await noAuth.POST(upload({headers:{authorization:'Bearer wrong'}}))).status,401);assert.deepEqual(noAuth.state.events,[['bridge-auth']]);
 for(const mutation of [null,{kind:'chat'},{status:'cancelled'},{lease_token:crypto.randomUUID()},{lease_until:Date.now()-1}]){
  const {state,POST}=fixture();state.lease=mutation===null?null:{...state.lease,...mutation};assert.equal((await POST(upload())).status,409);assert.equal(state.uploads.length,0);
 }
 for(const [headers,status] of [[{'content-type':'text/plain'},415],[{'content-length':'0'},413],[{'content-length':'10000001'},413],[{'content-length':'NaN'},413],[{'content-length':'33'},400]]){
  const {state,POST}=fixture();assert.equal((await POST(upload({headers}))).status,status);assert.equal(state.uploads.length,0);
 }
 const malformed=fixture();assert.equal((await malformed.POST(upload({bytes:new Uint8Array(32)}))).status,400);assert.equal(malformed.state.uploads.length,0);
});
test('accepted MP4 is stored under the leased job id and never a caller-supplied path',async()=>{
 const {state,POST}=fixture(),response=await POST(upload());assert.equal(response.status,200);assert.deepEqual(await response.json(),{artifactId:id,bytes:32});assert.equal(state.uploads.length,1);
 const stored=state.uploads[0];assert.equal(stored.key,'videos/'+id);assert.equal(stored.bytes.byteLength,32);assert.equal(stored.options.httpMetadata.contentType,'video/mp4');assert.equal(stored.options.customMetadata.jobId,id);
 const invalid=fixture();assert.equal((await invalid.POST(upload(),'../../private')).status,400);assert.equal(invalid.state.uploads.length,0);
});
test('streaming uploads cancel as soon as the body exceeds its declared limit',async()=>{
 const {state,POST}=fixture();let cancelled=false;
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(40));},cancel(){cancelled=true;}});
 const request=new Request('https://atlas.test/api/cloud/artifacts/'+id,{method:'POST',headers:{authorization:'Bearer test-bridge','X-Atlas-Lease':lease,'content-type':'video/mp4','content-length':'32'},body,duplex:'half'});
 assert.equal((await POST(request)).status,413);assert.equal(cancelled,true);assert.equal(state.uploads.length,0);
 const missing=fixture();const empty=new Request('https://atlas.test/api/cloud/artifacts/'+id,{method:'POST',headers:{authorization:'Bearer test-bridge','X-Atlas-Lease':lease,'content-type':'video/mp4','content-length':'32'}});assert.equal((await missing.POST(empty)).status,400);assert.equal(missing.state.uploads.length,0);
});
