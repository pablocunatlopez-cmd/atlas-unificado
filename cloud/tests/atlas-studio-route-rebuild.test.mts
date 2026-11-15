// Run: node --experimental-vm-modules --experimental-strip-types tests/atlas-studio-route-rebuild.test.mts
// Exercise the real HTTP route, compiler, rebuild policy and SQL against SQLite.
// Only the Worker binding, sign-in/origin boundary and research profile are local.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFile} from 'node:fs/promises';
import * as vm from 'node:vm';
import {z} from 'zod';
import * as generator from '../lib/studio/generator.ts';
import * as rebuild from '../lib/studio/rebuild.ts';
import {buildScene,type Brief} from '../lib/studio/scene.ts';
import {STUDIO_SQL} from '../lib/studio/storage-sql.ts';

class Statement{
 readonly db:DatabaseSync;readonly sql:string;readonly values:SQLInputValue[];
 constructor(db:DatabaseSync,sql:string,values:SQLInputValue[]=[]){this.db=db;this.sql=sql;this.values=values;}
 bind(...values:SQLInputValue[]){return new Statement(this.db,this.sql,values);}
 async first(){return this.db.prepare(this.sql).get(...this.values)||null;}
 async all(){return{results:this.db.prepare(this.sql).all(...this.values),success:true};}
 async run(){const result=this.db.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:result.changes,last_row_id:result.lastInsertRowid}};}
}
class D1{
 raw=new DatabaseSync(':memory:');batches=0;
 constructor(){this.raw.exec('PRAGMA foreign_keys=ON;CREATE TABLE studio_projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,mode TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE studio_versions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES studio_projects(id),version INTEGER NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(project_id,version));');}
 prepare(sql:string){return new Statement(this.raw,sql);}
 async batch(statements:Statement[]){this.batches++;this.raw.exec('BEGIN IMMEDIATE');try{const out=[];for(const statement of statements)out.push(await statement.run());this.raw.exec('COMMIT');return out;}catch(error){this.raw.exec('ROLLBACK');throw error;}}
 close(){this.raw.close();}
}
const projectId='11111111-1111-4111-8111-111111111111',bobProjectId='22222222-2222-4222-8222-222222222222';
const prompt='Una casa con una escultura propia';
const authoredPlan={version:2,title:'Casa propia',variant:'architecture',lighting:'sunset',palette:'Azul',objects:[{name:'Escultura propia',type:'cone',position:[4,1,0],size:[1,1,1],material:12,yaw:.3}],materials:[{color:[.2,.3,.8],roughness:.45,metalness:.3,emission:0}],camera:[12,8,10],target:[2,1,0],design:'Conservar una composición propia sin edificios prefijados.'};
type ProjectPayload={project:{id:string;revision:number;viewingVersion:number;brief:Brief;code:string}};
type ErrorPayload={error:string;code?:string;href?:string;project?:unknown};
async function fixture(){
 assert.equal(typeof vm.SourceTextModule,'function','Pass --experimental-vm-modules.');
 const db=new D1(),state={user:{userId:'alice'} as {userId:string}|null,researchCalls:0},generated=generator.generateProject(prompt,'3d',{plan:authoredPlan});
 for(const [id,owner,title]of [[projectId,'alice','Casa propia'],[bobProjectId,'bob','Proyecto privado de Bob']]){
  const brief={...generated.brief,title},content=JSON.stringify({brief,code:generated.code});
  db.raw.prepare('INSERT INTO studio_projects VALUES(?,?,?,?,?,?,?)').run(id,owner,title,'3d',1,'2026-11-15T10:00:00Z','2026-11-15T10:00:00Z');
  db.raw.prepare('INSERT INTO studio_versions VALUES(?,?,?,?,?)').run(id+'-v1',id,1,content,'2026-11-15T10:00:00Z');
 }
 const context=vm.createContext({Request,Response,URL,Date,crypto:globalThis.crypto,structuredClone,console});
 const dependencies:Record<string,Record<string,unknown>>={
  'cloudflare:workers':{env:{DB:db}},zod:{z},
  '@/app/chatgpt-auth':{getChatGPTUser:async()=>state.user},
  '@/lib/server-state':{allowedOrigin:(request:Request)=>request.headers.get('origin')==='https://atlas.test',privateHeaders:{'Cache-Control':'private, no-store'}},
  '@/lib/studio/generator':generator,'@/lib/studio/rebuild':rebuild,'@/lib/studio/storage-sql':{STUDIO_SQL},
  '@/lib/research/server':{researchPayload:async()=>{state.researchCalls++;return{control:{spiral:{profiles:{meshRows:18}}}};}}
 };
 const source=stripTypeScriptTypes(await readFile(new URL('../app/api/studio/route.ts',import.meta.url),'utf8'),{mode:'strip'}),module=new vm.SourceTextModule(source,{context,identifier:'studio-route.ts'}),linked=new Map<string,vm.Module>();
 await module.link(async name=>{if(linked.has(name))return linked.get(name)!;const exports=dependencies[name];assert.ok(exports,'Unexpected dependency: '+name);const keys=Object.keys(exports),dependency=new vm.SyntheticModule(keys,function(){for(const key of keys)this.setExport(key,exports[key]);},{context});linked.set(name,dependency);return dependency;});
 await module.evaluate();
 const api=module.namespace as unknown as {POST:(request:Request)=>Promise<Response>;GET:(request:Request)=>Promise<Response>};
 const post=(input:unknown,origin='https://atlas.test')=>api.POST(new Request('https://atlas.test/api/studio',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(input)}));
 const snapshot=()=>JSON.stringify({projects:db.raw.prepare('SELECT * FROM studio_projects ORDER BY id').all(),versions:db.raw.prepare('SELECT * FROM studio_versions ORDER BY id').all()});
 return{db,state,api,post,snapshot,generated};
}

test('HTTP configuration rebuild appends a version while preserving authored geometry and the original version',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 const old=f.db.raw.prepare('SELECT content FROM studio_versions WHERE project_id=? AND version=1').get(projectId)!.content;
 const response=await f.post({id:projectId,revision:1,prompt,mode:'3d',lighting:'night',palette:'Oro',seed:42,quality:'high'}),payload=await response.json() as ProjectPayload;
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 const project=payload.project;assert.equal(project.id,projectId);assert.equal(project.revision,2);assert.equal(project.viewingVersion,2);assert.equal(project.brief.plan?.version,2);assert.equal(project.brief.preview,'eras');
 assert.deepEqual(buildScene(project.brief).objects,buildScene(f.generated.brief).objects);assert.equal(buildScene(project.brief).objects.length,1);assert.equal(buildScene(project.brief).objects[0].name,'Escultura propia');
 assert.deepEqual(project.brief.plan?.materials,f.generated.brief.plan!.materials);assert.equal(project.brief.lighting,'night');assert.equal(project.brief.palette,'Oro');assert.equal(project.brief.seed,42);assert.equal(project.brief.quality,'high');
 assert.equal(f.db.raw.prepare('SELECT content FROM studio_versions WHERE project_id=? AND version=1').get(projectId)!.content,old);
 assert.equal(f.db.raw.prepare('SELECT count(*) AS n FROM studio_versions WHERE project_id=?').get(projectId)!.n,2);assert.equal(f.state.researchCalls,1);
 const read=await f.api.GET(new Request('https://atlas.test/api/studio?id='+projectId+'&version=1')),history=await read.json() as ProjectPayload;assert.equal(read.status,200);assert.deepEqual(history.project.brief.plan,f.generated.brief.plan);assert.equal(history.project.viewingVersion,1);assert.equal(history.project.revision,2);
});
test('saving custom HTML selects its own preview and persists it without changing the preceding scene revision',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const code='<!doctype html><html><body><p>Mi revisión propia</p><script>document.body.dataset.ready="yes";</script></body></html>';
 const response=await f.post({id:projectId,revision:1,code}),payload=await response.json() as ProjectPayload;assert.equal(response.status,200);assert.equal(payload.project.revision,2);assert.equal(payload.project.brief.preview,'html');assert.equal(payload.project.code,code);assert.deepEqual(payload.project.brief.plan,f.generated.brief.plan);assert.equal(f.state.researchCalls,0);
 const latest=await f.api.GET(new Request('https://atlas.test/api/studio?id='+projectId)),saved=await latest.json() as ProjectPayload;assert.equal(latest.status,200);assert.equal(saved.project.brief.preview,'html');assert.equal(saved.project.code,code);
 const previous=await f.api.GET(new Request('https://atlas.test/api/studio?id='+projectId+'&version=1')),old=await previous.json() as ProjectPayload;assert.equal(previous.status,200);assert.equal(old.project.brief.preview,f.generated.brief.preview);assert.equal(old.project.code,f.generated.code);
});
test('a changed description or mode returns an explicit AI handoff and performs no database mutation',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const before=f.snapshot();
 for(const input of [{prompt:'Un bosque completamente diferente',mode:'3d',href:'/?room=lab'},{prompt,mode:'game',href:'/?room=games'}]){
  const response=await f.post({id:projectId,revision:1,prompt:input.prompt,mode:input.mode}),payload=await response.json() as ErrorPayload;assert.equal(response.status,409);assert.equal(payload.code,'AI_REDESIGN_REQUIRED');assert.equal(payload.href,input.href);assert.match(payload.error,/versiones se conservan/);assert.equal(f.snapshot(),before);
 }
 assert.equal(f.db.batches,0);assert.equal(f.state.researchCalls,0);
});
test('ownership and stale revision checks reject rebuilds before the compiler can write',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const before=f.snapshot();
 for(const input of [{id:bobProjectId,revision:1},{id:projectId,revision:2}]){
  const response=await f.post({...input,prompt,mode:'3d',lighting:'night'}),payload=await response.json() as ErrorPayload;assert.equal(response.status,409);assert.ok(!payload.project);assert.doesNotMatch(JSON.stringify(payload),/Proyecto privado de Bob/);assert.equal(f.snapshot(),before);
 }
 const read=await f.api.GET(new Request('https://atlas.test/api/studio?id='+bobProjectId));assert.equal(read.status,404);assert.equal(f.db.batches,0);assert.equal(f.state.researchCalls,0);
});
test('sign-in and origin guards protect both scene rebuilding and code-save branches',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const before=f.snapshot(),input={id:projectId,revision:1,prompt,mode:'3d'};
 f.state.user=null;assert.equal((await f.post(input)).status,401);assert.equal((await f.api.GET(new Request('https://atlas.test/api/studio?id='+projectId))).status,401);
 f.state.user={userId:'alice'};assert.equal((await f.post(input,'https://foreign.test')).status,403);assert.equal((await f.post({id:projectId,revision:1,code:'<!doctype html><html><body>Changed</body></html>'},'https://foreign.test')).status,403);
 assert.equal(f.snapshot(),before);assert.equal(f.db.batches,0);assert.equal(f.state.researchCalls,0);
});
