import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createCloudStudioProject,CloudStudioProjectError} from '../lib/studio/cloud-project-client.ts';

const require=createRequire(import.meta.url),source=readFileSync(new URL('../app/world-workshop.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const gate=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function nodes(value){return Array.isArray(value)?value.flatMap(nodes):value?.props?[value,...nodes(value.props.children)]:[];}
function project(id='11111111-1111-4111-8111-111111111111',prompt='Una casa'){return{id,title:'Casa',mode:'3d',prompt,brief:{mode:'3d',title:'Casa',prompt,palette:'Blanco',lighting:'day',quality:'balanced',seed:1,unsupported:[]},code:'<!doctype html><title>Casa</title>',revision:1,viewingVersion:1,createdAt:'2026-11-21T12:00:00Z',updatedAt:'2026-11-21T12:00:00Z',versions:[{version:1,date:'2026-11-21T12:00:00Z'}]};}
function harness(create,fetcher=async()=>Response.json({status:'cancelled'})){
 const slots=[],effects=[],cleanups=[];let cursor=0,tree,mounted=true,afterUnmountWrites=0,uuid=0;const calls=[];
 const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{if(!mounted)afterUnmountWrites++;slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(initial){const i=cursor++;return slots[i]??=( {current:initial});},useEffect(effect,deps){const i=cursor++,prior=slots[i];if(!prior||deps.some((v,j)=>v!==prior[j])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=effect();});}}};
 const AtlasStudio=()=>null,exports={};
 const customRequire=id=>id==='react'?hooks:id==='./atlas-studio'?{default:AtlasStudio}:id==='./workspace-tools.module.css'?{default:{panel:'panel',row:'row',status:'status',error:'error',secondary:'secondary'}}:id==='../lib/studio/cloud-project-client'?{createCloudStudioProject:(input,options)=>{calls.push({input,options});return create(input,options);},CloudStudioProjectError}:id==='../public/house/house-quest.js'?{housePrototypeHref:()=>'/jugar/casa'}:require(id);
 new Script(compiled,{filename:'world-workshop.component.cjs'}).runInNewContext({exports,require:customRequire,AbortController,AbortSignal,Error,fetch:fetcher,crypto:{randomUUID:()=>`11111111-1111-4111-8111-${String(++uuid).padStart(12,'0')}`}});
 const render=()=>{cursor=0;tree=exports.default({mode:'3d',ready:true});for(const fn of effects.splice(0))fn();return tree;};
 const createButton=()=>nodes(render()).find(n=>n.type==='button'&&n.props.className===undefined);
 const cancelButton=()=>nodes(render()).find(n=>n.type==='button'&&n.props.className==='secondary');
 const start=()=>{const button=createButton();assert.ok(button);button.props.onClick();};
 const change=value=>nodes(render()).find(n=>n.type==='textarea').props.onChange({target:{value}});
 const installed=()=>nodes(render()).find(n=>n.type===AtlasStudio).props.initialProjectId;
 const stop=()=>{const button=cancelButton();assert.ok(button);button.props.onClick();};
 return{calls,render,start,change,installed,stop,createButton,all:()=>nodes(render()),unmount(){mounted=false;for(const fn of cleanups)fn?.();},get afterUnmountWrites(){return afterUnmountWrites;}};
}
function backend({loseFirst=false,failFirst=false}={}){
 const requests=[],jobs=new Map();let lost=false,created=0;
 const fetcher=async(url,init={})=>{
  requests.push({url:String(url),init});
  if(url==='/api/cloud/chat'){
   const input=JSON.parse(init.body);let job=jobs.get(input.requestId);
   if(!job){const serial=++created;job={id:'job-'+String(serial).padStart(64,'0'),project:project(`11111111-1111-4111-8111-${String(serial).padStart(12,'0')}`,input.message),failed:failFirst&&serial===1};jobs.set(input.requestId,job);}
   if(loseFirst&&!lost){lost=true;throw Error('Response lost after enqueue');}
   return Response.json({jobId:job.id,status:'queued'},{status:202});
  }
  if(String(url).startsWith('/api/cloud/jobs/')){const j=[...jobs.values()].find(j=>String(url).endsWith(j.id));assert.ok(j);return Response.json(j.failed?{id:j.id,status:'failed',error:'El diseño falló.'}:{id:j.id,status:'completed',result:{creative:{projectId:j.project.id}}});}
  if(String(url).startsWith('/api/studio?id=')){const id=new URL(String(url),'https://atlas.test').searchParams.get('id'),j=[...jobs.values()].find(j=>j.project.id===id);assert.ok(j);return Response.json({project:j.project});}
  assert.fail('Unexpected URL '+url);
 };
 return{fetcher,requests,jobs,get created(){return created;}};
}

test('a lost POST response is recovered by the actual client without a second job or model side effect',async()=>{
 const server=backend({loseFirst:true}),ui=harness((input,options)=>createCloudStudioProject(input,{...options,fetcher:server.fetcher,wait:async()=>{}}));
 ui.start();await flush();assert.equal(server.created,1);assert.equal(ui.installed(),undefined);
 ui.start();await flush();assert.equal(server.created,1);assert.equal(ui.calls.length,2);assert.equal(ui.calls[0].input.requestId,ui.calls[1].input.requestId);assert.equal(ui.installed(),[...server.jobs.values()][0].project.id);
 assert.equal(server.requests.filter(r=>r.url==='/api/cloud/chat').length,2,'Only the idempotent enqueue is retried, not a new creation.');
});
test('changed descriptions create a fresh request; immediate double clicks cannot create two jobs',async()=>{
 const pending=gate(),ui=harness(()=>pending.promise);ui.start();ui.start();assert.equal(ui.calls.length,1);pending.reject(new CloudStudioProjectError('Sin red','network'));await flush();
 ui.change('Un bosque completamente diferente');ui.start();assert.equal(ui.calls.length,2);assert.notEqual(ui.calls[0].input.requestId,ui.calls[1].input.requestId);
});
test('a deterministic failed job can be explicitly retried as a new attempt',async()=>{
 const server=backend({failFirst:true}),ui=harness((input,options)=>createCloudStudioProject(input,{...options,fetcher:server.fetcher,wait:async()=>{}}));
 ui.start();await flush();assert.equal(server.created,1);assert.equal(ui.installed(),undefined);ui.start();await flush();assert.equal(server.created,2);assert.notEqual(ui.calls[0].input.requestId,ui.calls[1].input.requestId);assert.ok(ui.installed());
});
test('unmount aborts the request and ignores a late successful project',async()=>{
 const pending=gate(),ui=harness(()=>pending.promise);ui.start();const signal=ui.calls[0].options.signal;ui.unmount();assert.equal(signal.aborted,true);pending.resolve(project());await flush();assert.equal(ui.afterUnmountWrites,0);
});
test('failed cancellation keeps the stable request ID, blocks overlapping creation and ignores the old result',async()=>{
 const first=gate(),second=gate(),deletion=gate();let attempts=0,deleteCalls=0;
 const ui=harness((input,options)=>{options.onJob({id:'job-'+String(++attempts).padStart(64,'0'),status:'running'});return attempts===1?first.promise:second.promise;},async()=>{deleteCalls++;return deletion.promise;});
 ui.start();ui.stop();ui.start();ui.stop();assert.equal(ui.calls.length,1);assert.equal(deleteCalls,1);assert.equal(ui.createButton().props.disabled,true);assert.equal(ui.calls[0].options.signal.aborted,true);
 deletion.resolve(Response.json({error:'Sin confirmación'},{status:503}));await flush();assert.equal(ui.createButton().props.disabled,false);
 ui.start();assert.equal(ui.calls.length,2);assert.equal(ui.calls[0].input.requestId,ui.calls[1].input.requestId);
 second.resolve(project('22222222-2222-4222-8222-222222222222'));await flush();first.resolve(project('11111111-1111-4111-8111-111111111111'));await flush();assert.equal(ui.installed(),'22222222-2222-4222-8222-222222222222');
});
test('confirmed cancellation rotates the request ID for a new attempt and never installs the cancelled result',async()=>{
 const first=gate();let attempts=0;const ui=harness((input,options)=>{attempts++;options.onJob({id:'job-'+String(attempts).padStart(64,'0'),status:'running'});return attempts===1?first.promise:Promise.resolve(project());});
 ui.start();ui.stop();await flush();ui.start();await flush();assert.notEqual(ui.calls[0].input.requestId,ui.calls[1].input.requestId);first.resolve(project('33333333-3333-4333-8333-333333333333'));await flush();assert.equal(ui.installed(),'11111111-1111-4111-8111-111111111111');
});
test('a job already completed during cancellation is recovered with its original ID',async()=>{
 const first=gate();let attempts=0;const ui=harness((input,options)=>{attempts++;options.onJob({id:'job-'+String(attempts).padStart(64,'0'),status:'running'});return attempts===1?first.promise:Promise.resolve(project());},async()=>Response.json({status:'completed'}));
 ui.start();ui.stop();await flush();ui.start();await flush();assert.equal(ui.calls[0].input.requestId,ui.calls[1].input.requestId);assert.ok(ui.installed());first.resolve(project('33333333-3333-4333-8333-333333333333'));await flush();assert.notEqual(ui.installed(),'33333333-3333-4333-8333-333333333333');
});
