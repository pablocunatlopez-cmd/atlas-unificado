import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {openRepositoryLibrary,METADATA_TTL_MS} from './repo-library.mjs';
import {openRepositoryDiscovery,loadRepositoryTaxonomy,DISCOVERY_INTERVAL_MS,DISCOVERY_SEGMENT_START_DAY,DISCOVERY_SEGMENT_MAX_DEPTH,DISCOVERY_SEGMENT_MAX_SHARDS,DISCOVERY_PASS_MAX_IDS} from './repository-discovery.mjs';

const repo=(id,name='example/repository-'+id)=>({id,full_name:name,private:false,description:'Proyecto público de prueba '+id,stargazers_count:id,forks_count:0,language:'Rust',topics:['testing'],license:{spdx_id:'MIT',name:'MIT License'},default_branch:'main',archived:false});
const response=(items,{total=items.length,incomplete=false,status=200,headers={}}={})=>new Response(JSON.stringify({total_count:total,incomplete_results:incomplete,items}),{status,headers:{'Content-Type':'application/json',...headers}});
const seed='AT-001 · Semilla\nLicencia MIT, afirmación importada sin verificar.\nhttps://github.com/example/seed\n';

async function fixture(t,{seeded=true,singleJob=false,repositoryLimit=100000}={}){
 const directory=await mkdtemp(join(tmpdir(),'atlas-discovery-test-')),dbPath=join(directory,'library.sqlite');
 const time={value:Date.parse('2026-10-31T18:00:00Z')};
 const library=openRepositoryLibrary({dbPath,now:()=>time.value});
 if(seeded)library.importCatalog(seed);
 const discovery=openRepositoryDiscovery({dbPath,now:()=>time.value,repositoryLimit});
 const db=new DatabaseSync(dbPath);
 if(singleJob)db.prepare("UPDATE discovery_jobs SET next_run_ms=? WHERE category_id<>'CAT-001'").run(time.value+10*METADATA_TTL_MS);
 t.after(async()=>{for(const connection of [db,discovery,library])try{connection.close();}catch{}assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('atlas-discovery-test-'));await rm(directory,{recursive:true,force:true});});
 return {directory,dbPath,library,discovery,db,time,tick:()=>{time.value+=DISCOVERY_INTERVAL_MS;}};
}

test('taxonomía propuesta tiene exactamente25×10, IDs y queries únicos, sin ganadores',()=>{
 const taxonomy=loadRepositoryTaxonomy();assert.equal(taxonomy.version,1);assert.equal(taxonomy.status,'draft');
 assert.equal(taxonomy.macroareas.length,25);assert.ok(taxonomy.macroareas.every(area=>area.categories.length===10));
 assert.equal(taxonomy.categories.length,250);assert.equal(new Set(taxonomy.categories.map(c=>c.query)).size,250);
 assert.equal(taxonomy.categories[0].id,'CAT-001');assert.equal(taxonomy.categories.at(-1).id,'CAT-250');
});

test('una búsqueda pública agrega nuevos, deduplica semillas e IDs y registra bruto fechado',async t=>{
 const {discovery,library,db,time}=await fixture(t);let calls=0;
 const result=await discovery.discover({request:async(url,options)=>{
  calls++;const request=new URL(url);assert.equal(request.origin,'https://api.github.com');assert.equal(request.pathname,'/search/repositories');
  assert.equal(request.searchParams.get('per_page'),'100');assert.equal(request.searchParams.get('page'),'1');
  assert.equal(options.redirect,'manual');assert.equal(options.method,'GET');assert.equal(Object.keys(options.headers).some(key=>key.toLowerCase()==='authorization'),false);
  return response([repo(1,'example/seed'),repo(2),repo(2)]);
 }});
 assert.equal(calls,1);assert.equal(result.status,'searched');assert.equal(result.added,1);assert.equal(result.imported,1);assert.equal(result.duplicates,1);
 assert.equal(discovery.summary().categories,250);assert.equal(discovery.summary().discovered,1);assert.equal(discovery.summary().matchedSeeds,1);
 assert.equal(discovery.summary().segmentation.version,2);assert.equal(discovery.summary().segmentation.passCoverageTracked,true);
 assert.equal(discovery.summary().elite,0);assert.equal(discovery.summary().winners,0);assert.equal(library.summary().counts.repositories,2);
 const items=discovery.list().items;assert.equal(items.length,1);assert.equal(items[0].id,'GH-2');assert.equal(items[0].evidence,'C');
 assert.equal(items[0].verifiedLicense,null);assert.equal(items[0].metadataVerifiedAt,null);assert.equal(items[0].metadata.language,'Rust');
 const raw=db.prepare('SELECT * FROM discovery_observations').get();assert.equal(JSON.parse(raw.raw_json).items.length,3);assert.equal(raw.checked_at,new Date(time.value).toISOString());
 const queued=db.prepare("SELECT next_check_ms,verification_status FROM resources WHERE url='https://github.com/example/repository-2'").get();
 assert.equal(queued.next_check_ms,time.value);assert.equal(queued.verification_status,'discovered');
});

test('cursor y metadatos sobreviven reinicio; paginación continúa por la misma consulta',async t=>{
 const {discovery,dbPath,time,tick}=await fixture(t,{singleJob:true,seeded:false});
 const items=Array.from({length:100},(_,index)=>repo(index+1));
 const first=await discovery.discover({request:async()=>response(items,{total:130})});assert.equal(first.nextPage,2);tick();
 const reopened=openRepositoryDiscovery({dbPath,now:()=>time.value});
 try{
  const next=await reopened.discover({request:async url=>{assert.equal(new URL(url).searchParams.get('page'),'2');return response(Array.from({length:30},(_,index)=>repo(index+101)),{total:130});}});
  assert.equal(next.jobStatus,'complete');assert.equal(reopened.summary().discovered,130);assert.equal(reopened.list({offset:100,limit:20}).items.length,20);
 }finally{reopened.close();}
});

test('consulta de exactamente1000 IDs distintos: nunca solicita página11 y acota cada pase',async t=>{
 const {discovery,tick,db}=await fixture(t,{singleJob:true,seeded:false});let calls=0;
 for(let page=1;page<=10;page++){
  const items=Array.from({length:100},(_,index)=>repo((page-1)*100+index+1));
  const result=await discovery.discover({request:async url=>{calls++;assert.equal(Number(new URL(url).searchParams.get('page')),page);return response(items,{total:1000});}});
  assert.equal(result.truncated,false);assert.equal(result.added,100);assert.equal(result.coverage.distinctIds,page*100);assert.equal(result.coverage.overlapIds,0);tick();
 }
 assert.equal(calls,10);assert.equal(discovery.summary().discovered,1000);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM discovery_pass_members').get().n,DISCOVERY_PASS_MAX_IDS);
 const job=db.prepare("SELECT * FROM discovery_jobs WHERE category_id='CAT-001'").get();assert.equal(job.status,'complete');assert.equal(job.next_page,10);assert.equal(job.total_count,1000);
 assert.equal((await discovery.discover({request:()=>{throw Error('No debe solicitar página11');}})).status,'cached');
});

test('consulta terminada espera24h y luego reinicia página1 sin perder observaciones',async t=>{
 const {discovery,time}=await fixture(t,{singleJob:true,seeded:false});let calls=0;
 const request=async url=>{calls++;assert.equal(new URL(url).searchParams.get('page'),'1');return response([repo(1)]);};
 await discovery.discover({request});time.value+=METADATA_TTL_MS-1;
 assert.equal((await discovery.discover({request})).status,'cached');assert.equal(calls,1);
 time.value++;assert.equal((await discovery.discover({request})).added,0);assert.equal(calls,2);assert.equal(discovery.summary().searchObservations,2);
});

test('intervalo limita llamadas repetidas antes del próximo turno',async t=>{
 const {discovery}=await fixture(t);let calls=0;
 await discovery.discover({request:async()=>{calls++;return response([]);}});
 assert.equal((await discovery.discover({request:async()=>{calls++;return response([]);}})).status,'waiting');assert.equal(calls,1);
});

test('prioriza agentes, modelos, memoria, pruebas, seguridad y gráficos antes de sistemas',async t=>{
 const {discovery,tick}=await fixture(t,{seeded:false}),categories=[];
 for(let index=0;index<7;index++){const result=await discovery.discover({request:async()=>response([])});categories.push(result.categoryId);tick();}
 assert.deepEqual(categories,['CAT-141','CAT-131','CAT-111','CAT-091','CAT-021','CAT-071','CAT-181']);
});

test('403 y reset comparten backoff con metadatos, persistente tras reinicio',async t=>{
 const {discovery,library,dbPath,time}=await fixture(t);let calls=0;const reset=time.value+120000;
 const result=await discovery.discover({request:async()=>{calls++;return response([],{status:403,headers:{'Retry-After':'20','X-RateLimit-Reset':String(reset/1000)}});}});
 assert.equal(result.status,'rate_limited');assert.equal(result.nextRun,new Date(reset+1000).toISOString());
 const reopened=openRepositoryDiscovery({dbPath,now:()=>time.value});
 try{assert.equal((await reopened.discover({request:()=>{calls++;throw Error('Bloqueado');}})).status,'backoff');}finally{reopened.close();}
 assert.equal((await library.refreshNext({request:()=>{calls++;throw Error('Bloqueado');}})).status,'backoff');assert.equal(calls,1);
});

test('429 fecha Retry-After y cuota restante0 detienen búsquedas futuras',async t=>{
 const {discovery,time}=await fixture(t);let calls=0;const until=time.value+90000;
 const first=await discovery.discover({request:async()=>{calls++;return response([],{status:429,headers:{'Retry-After':new Date(until).toUTCString()}});}});
 assert.equal(first.nextRun,new Date(until+1000).toISOString());time.value=until+1001;
 const second=await discovery.discover({request:async()=>{calls++;return response([repo(5)],{headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':String((time.value+60000)/1000)}});}});
 assert.equal(second.added,1);assert.equal((await discovery.discover({request:()=>{calls++;throw Error('No debe llamar');}})).status,'backoff');assert.equal(calls,2);
});

test('lease compartido evita competir con otro descubrimiento y metadatos',async t=>{
 const {discovery,library}=await fixture(t);let finish;
 const first=discovery.discover({request:()=>new Promise(resolve=>{finish=resolve;})});
 assert.equal((await discovery.discover({request:()=>{throw Error('No debe iniciar');}})).status,'busy');
 assert.equal((await library.refreshNext({request:()=>{throw Error('No debe iniciar');}})).status,'busy');
 finish(response([]));await first;assert.notEqual(discovery.summary().state,'busy');
});

test('IDs estables deduplican renombres y semillas contrastadas aunque cambie la URL',async t=>{
 const {discovery,db,tick}=await fixture(t);
 db.prepare("UPDATE resources SET metadata_json=? WHERE url='https://github.com/example/seed'").run(JSON.stringify({githubId:1,fullName:'example/seed'}));
 const first=await discovery.discover({request:async()=>response([repo(1,'new-owner/seed'),repo(2,'owner/project')])});
 assert.equal(first.added,1);assert.equal(first.imported,1);tick();
 const second=await discovery.discover({request:async()=>response([repo(2,'renamed/project')])});
 assert.equal(second.added,0);assert.equal(discovery.summary().discovered,1);assert.equal(discovery.list().items[0].url,'https://github.com/renamed/project');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM resources').get().n,2);
});

test('URL ocupada por otra identidad y resultados inválidos se registran sin duplicación',async t=>{
 const {discovery,tick}=await fixture(t,{seeded:false});
 await discovery.discover({request:async()=>response([repo(1,'example/same')])});tick();
 const result=await discovery.discover({request:async()=>response([repo(2,'example/same'),{...repo(3),private:true},{...repo(4),full_name:'../bad'},repo(5)])});
 assert.equal(result.invalid,3);assert.equal(result.added,1);assert.equal(discovery.summary().discovered,2);
});

test('resultado incompleto no declara cobertura ni validación',async t=>{
 const {discovery}=await fixture(t);
 const result=await discovery.discover({request:async()=>response([repo(1)],{total:700,incomplete:true})});
 assert.equal(result.incomplete,true);assert.equal(result.jobStatus,'segmenting');assert.equal(result.segmentationPending,true);assert.equal(discovery.summary().validatedCategories,0);
});

test('erroresHTTP/formato mantienen el cursor y no acreditan descubrimientos',async t=>{
 const {discovery,db,tick}=await fixture(t);
 const bad=await discovery.discover({request:async()=>response([],{status:502})});assert.equal(bad.status,'error');tick();
 const excessive=await discovery.discover({request:async()=>response(Array.from({length:101},(_,index)=>repo(index+1)),{total:101})});
 assert.equal(excessive.status,'error');assert.equal(discovery.summary().discovered,0);
 assert.equal(db.prepare("SELECT next_page FROM discovery_jobs WHERE status='error' ORDER BY last_checked_ms LIMIT 1").get().next_page,1);
});

test('cancelar conserva el cursor y libera el turno compartido',async t=>{
 const {discovery,db}=await fixture(t);const controller=new AbortController();
 const pending=discovery.discover({signal:controller.signal,request:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 controller.abort(Error('Cancelación solicitada'));await assert.rejects(pending,/Cancelación solicitada/);
 assert.notEqual(discovery.summary().state,'busy');assert.equal(db.prepare("SELECT next_page FROM discovery_jobs WHERE status='cancelled'").get().next_page,1);
 const aborted=new AbortController();aborted.abort(Error('Antes'));
 await assert.rejects(discovery.discover({signal:aborted.signal,request:()=>{throw Error('No debe ejecutarse');}}),/Antes/);
});

test('búsqueda y paginación de fichas descubiertas no incluyen semillas ni comodinesSQL',async t=>{
 const {discovery}=await fixture(t);
 await discovery.discover({request:async()=>response([repo(1,'example/seed'),repo(2,'example/special'),repo(3,'example/other')])});
 assert.equal(discovery.list({query:'special'}).total,1);assert.equal(discovery.list({query:'GH-2'}).items[0].id,'GH-2');
 assert.equal(discovery.list({query:'%'}).total,0);assert.equal(discovery.list({limit:1,offset:1}).items.length,1);assert.equal(discovery.list().total,2);
});

test('límite de admisión incluye semillas, recorta una página100 y permite actualizar existentes',async t=>{
 const {discovery,library,tick,db}=await fixture(t,{repositoryLimit:3});
 const items=[repo(1,'example/seed'),...Array.from({length:99},(_,index)=>repo(index+2))];
 const first=await discovery.discover({request:async()=>response(items,{total:100})});
 assert.equal(first.added,2);assert.equal(first.imported,1);assert.equal(first.capped,97);
 assert.equal(library.summary().counts.repositories,3);assert.equal(discovery.summary().discovered,2);
 assert.equal(discovery.summary().capacityReached,true);assert.equal(discovery.summary().admissionRemaining,0);tick();
 const second=await discovery.discover({request:async()=>response([{...repo(2),description:'Metadatos nuevos'},repo(101)])});
 assert.equal(second.added,0);assert.equal(second.duplicates,1);assert.equal(second.capped,1);
 assert.equal(discovery.list({query:'GH-2'}).items[0].metadata.description,'Metadatos nuevos');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM resources WHERE github_owner IS NOT NULL').get().n,3);
 assert.equal(db.prepare('SELECT SUM(capped_count) AS n FROM discovery_observations').get().n,98);
});

async function seedSegments(fixture){
 const result=await fixture.discovery.discover({request:async()=>response([repo(1)],{total:50000})});
 assert.equal(result.jobStatus,'segmenting');fixture.tick();
 return fixture.db.prepare('SELECT * FROM discovery_shards ORDER BY start_day LIMIT 1').get();
}

test('consulta truncada conserva la observación original y divide mitades diarias inclusivas sin huecos ni solape',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});const root=await seedSegments(f);
 assert.equal(root.start_day,DISCOVERY_SEGMENT_START_DAY);assert.equal(root.end_day,new Date(f.time.value).toISOString().slice(0,10));
 let calls=0;const split=await f.discovery.discover({request:async url=>{
  calls++;const query=new URL(url).searchParams.get('q');assert.equal(query,'topic:kernel fork:false archived:false created:'+root.start_day+'..'+root.end_day);assert.equal(new URL(url).searchParams.get('page'),'1');return response([repo(1)],{total:50000});
 }});
 assert.equal(calls,1);assert.equal(split.splitCreated,2);assert.equal(split.shardStatus,'split');assert.equal(split.jobStatus,'segmenting');assert.equal(split.segmentationPending,true);
 const children=f.db.prepare('SELECT * FROM discovery_shards WHERE parent_shard_id=? ORDER BY start_day').all(root.shard_id);assert.equal(children.length,2);
 assert.equal(children[0].start_day,root.start_day);assert.equal(children[1].end_day,root.end_day);assert.equal(Date.parse(children[1].start_day)-Date.parse(children[0].end_day),86400000);assert.equal(children[0].depth,1);assert.equal(children[1].depth,1);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_observations WHERE shard_id IS NULL').get().n,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_observations WHERE shard_id=?').get(root.shard_id).n,1);
 assert.equal(f.discovery.summary().truncatedQueries,1);assert.equal(f.discovery.summary().segmentationPendingQueries,1);assert.equal(f.db.prepare('PRAGMA user_version').get().user_version,1);
});

test('particiones paginan y se reanudan por cursor propio; deduplican IDs y solo cierran el árbol al terminar todas las hojas',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});await seedSegments(f);await f.discovery.discover({request:async()=>response([repo(1)],{total:50000})});f.tick();
 let leftQuery;
 const first=await f.discovery.discover({request:async url=>{leftQuery=new URL(url).searchParams.get('q');return response(Array.from({length:100},(_,index)=>repo(index+1)),{total:130});}});
 assert.equal(first.shardStatus,'paged');assert.equal(first.nextPage,2);assert.equal(first.duplicates,1);f.tick();
 // The other disjoint half receives its own first page before the older leaf's
 // second page; neither cursor is confused with the category's legacy cursor.
 const right=await f.discovery.discover({request:async url=>{assert.notEqual(new URL(url).searchParams.get('q'),leftQuery);return response([]);}});assert.equal(right.shardStatus,'complete');assert.equal(right.jobStatus,'segmenting');f.tick();
 const reopened=openRepositoryDiscovery({dbPath:f.dbPath,now:()=>f.time.value});
 try{
  const last=await reopened.discover({request:async url=>{assert.equal(new URL(url).searchParams.get('q'),leftQuery);assert.equal(new URL(url).searchParams.get('page'),'2');return response(Array.from({length:30},(_,index)=>repo(index+101)),{total:130});}});
  assert.equal(last.shardStatus,'complete');assert.equal(last.jobStatus,'segmented');assert.equal(last.segmentationPending,false);assert.equal(reopened.summary().discovered,130);assert.equal(reopened.summary().segmentationPendingQueries,0);assert.equal(reopened.summary().truncatedQueries,1);assert.equal(reopened.summary().validatedCategories,0);
  assert.equal(f.db.prepare('SELECT COUNT(DISTINCT github_id) AS n FROM discovered_repositories').get().n,130);assert.equal(f.db.prepare('SELECT COUNT(DISTINCT job_id) AS n FROM discovery_hits').get().n,1);
 }finally{reopened.close();}
});

test('un día con más1000 resultados permanece saturado, no pide página11 y conserva causa y refresco diferido',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});const root=await seedSegments(f),today=new Date(f.time.value).toISOString().slice(0,10);
 f.db.prepare('UPDATE discovery_shards SET start_day=?,end_day=? WHERE shard_id=?').run(today,today,root.shard_id);
 const items=Array.from({length:100},(_,index)=>repo(index+1));let calls=0;
 for(let page=1;page<=10;page++){
  const result=await f.discovery.discover({request:async url=>{calls++;const target=new URL(url);assert.equal(target.searchParams.get('page'),String(page));assert.match(target.searchParams.get('q'),new RegExp('created:'+today+'\\.\\.'+today+'$'));return response(items,{total:50000});}});
  assert.equal(result.splitCreated,0);assert.equal(result.saturationReason,'day-resolution');assert.equal(result.segmentationPending,true);assert.equal(result.shardStatus,page===10?'saturated':'paged');f.tick();
 }
 assert.equal(calls,10);assert.equal(f.discovery.summary().segmentation.saturatedShards,1);assert.equal(f.discovery.summary().segmentationPendingQueries,1);assert.equal(f.db.prepare('SELECT status FROM discovery_jobs WHERE category_id=\'CAT-001\'').get().status,'saturated');
 assert.equal((await f.discovery.discover({request:()=>{throw Error('Sin página11');}})).status,'cached');assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_shards').get().n,1);
});

test('respuesta incompleta o página corta inesperada se subdivide y un día incompleto nunca queda completo',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});await seedSegments(f);
 const split=await f.discovery.discover({request:async()=>response([],{total:200,incomplete:true})});assert.equal(split.incomplete,true);assert.equal(split.shardStatus,'split');assert.equal(split.splitCreated,2);f.tick();
 const leaf=f.db.prepare("SELECT * FROM discovery_shards WHERE status='pending' ORDER BY start_day LIMIT 1").get(),today=new Date(f.time.value).toISOString().slice(0,10);
 f.db.prepare('UPDATE discovery_shards SET start_day=?,end_day=?,next_run_ms=0 WHERE shard_id=?').run(today,today,leaf.shard_id);
 const incomplete=await f.discovery.discover({request:async()=>response([],{total:100,incomplete:false})});assert.equal(incomplete.incomplete,true);assert.equal(incomplete.shardStatus,'incomplete');assert.equal(incomplete.segmentationPending,true);assert.equal(incomplete.saturationReason,'day-resolution');assert.notEqual(incomplete.jobStatus,'segmented');
});

test('particiones respetan cuota compartida y reinicio: 429 o cuota0 no duplican solicitudes ni nodos',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});const root=await seedSegments(f),until=f.time.value+90000;let calls=0;
 const limited=await f.discovery.discover({request:async()=>{calls++;return response([],{status:429,headers:{'Retry-After':'90'}});}});assert.equal(limited.status,'rate_limited');assert.equal(f.db.prepare('SELECT next_page FROM discovery_shards WHERE shard_id=?').get(root.shard_id).next_page,1);
 const reopened=openRepositoryDiscovery({dbPath:f.dbPath,now:()=>f.time.value});
 try{
  assert.equal((await reopened.discover({request:()=>{calls++;throw Error('Bloqueado');}})).status,'backoff');assert.equal((await f.library.refreshNext({request:()=>{calls++;throw Error('Bloqueado');}})).status,'backoff');assert.equal(calls,1);
  f.time.value=until+1001;
  const split=await reopened.discover({request:async()=>{calls++;return response([repo(1)],{total:50000,headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':String((f.time.value+60000)/1000)}});}});assert.equal(split.splitCreated,2);assert.equal(calls,2);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_shards').get().n,3);
  assert.equal((await reopened.discover({request:()=>{calls++;throw Error('Bloqueado');}})).status,'backoff');assert.equal(calls,2);
 }finally{reopened.close();}
});

test('cancelación de una partición conserva página, histórico y lease; otro arranque reanuda la misma consulta',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});const root=await seedSegments(f);let query;
 const controller=new AbortController(),pending=f.discovery.discover({signal:controller.signal,request:(url,{signal})=>{query=new URL(url).searchParams.get('q');return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 controller.abort(Error('Cancelar partición'));await assert.rejects(pending,/Cancelar partición/);
 assert.equal(f.db.prepare('SELECT next_page FROM discovery_shards WHERE shard_id=?').get(root.shard_id).next_page,1);assert.notEqual(f.discovery.summary().state,'busy');assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM discovery_observations WHERE status='cancelled' AND shard_id IS NOT NULL").get().n,1);
 const reopened=openRepositoryDiscovery({dbPath:f.dbPath,now:()=>f.time.value});
 try{const result=await reopened.discover({request:async url=>{assert.equal(new URL(url).searchParams.get('q'),query);assert.equal(new URL(url).searchParams.get('page'),'1');return response([]);}});assert.equal(result.jobStatus,'segmented');}finally{reopened.close();}
});

test('migración aditiva de tablas y shard_id conserva trabajos antiguos, observaciones y user_version1',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});
 f.db.exec('DROP INDEX discovery_observation_shard; ALTER TABLE discovery_observations DROP COLUMN shard_id; DROP TABLE discovery_shards;');
 f.db.prepare("UPDATE discovery_jobs SET status='truncated',truncated=1,total_count=50000,next_page=10,last_page=10,attempts=10 WHERE category_id='CAT-001'").run();
 f.db.prepare('INSERT INTO discovery_observations(job_id,source_url,page,checked_at,status,raw_json) VALUES(?,?,?,?,?,?)').run('v1:CAT-001','https://api.github.com/search/repositories?q=legacy',10,new Date(f.time.value).toISOString(),'searched','{"legacy":true}');
 const reopened=openRepositoryDiscovery({dbPath:f.dbPath,now:()=>f.time.value});
 try{
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version,1);assert.ok(f.db.prepare('PRAGMA table_info(discovery_observations)').all().some(column=>column.name==='shard_id'));
  const result=await reopened.discover({request:async url=>{assert.equal(new URL(url).searchParams.get('page'),'1');assert.match(new URL(url).searchParams.get('q'),/ created:/);return response([]);}});assert.equal(result.jobStatus,'segmented');
  const legacy=f.db.prepare('SELECT * FROM discovery_observations WHERE observation_id=1').get();assert.equal(legacy.raw_json,'{"legacy":true}');assert.equal(legacy.shard_id,null);
  const job=f.db.prepare("SELECT * FROM discovery_jobs WHERE category_id='CAT-001'").get();assert.equal(job.next_page,10);assert.equal(job.last_page,10);assert.equal(job.attempts,11);assert.equal(job.truncated,1);assert.equal(job.total_count,50000);
 }finally{reopened.close();}
 assert.equal(f.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('refresco de un árbol terminado añade solo la cola temporal nueva y mantiene nodos anteriores',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});const root=await seedSegments(f);await f.discovery.discover({request:async()=>response([])});
 assert.equal(f.discovery.summary().segmentationPendingQueries,0);f.time.value+=3*METADATA_TTL_MS;
 const refreshed=await f.discovery.discover({request:async()=>response([])});
 const roots=f.db.prepare('SELECT * FROM discovery_shards WHERE parent_shard_id IS NULL ORDER BY start_day').all();assert.equal(roots.length,2);assert.equal(roots[0].shard_id,root.shard_id);assert.equal(Date.parse(roots[1].start_day)-Date.parse(roots[0].end_day),86400000);assert.equal(roots[1].end_day,new Date(f.time.value).toISOString().slice(0,10));
 assert.equal(refreshed.range.startDay,roots[1].start_day);assert.equal(refreshed.range.endDay,roots[1].end_day);assert.equal(f.db.prepare('SELECT attempts FROM discovery_shards WHERE shard_id=?').get(root.shard_id).attempts,1);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_observations').get().n,3);assert.equal(f.discovery.summary().segmentationPendingQueries,0);
});

test('IDs repetidos en un mismo pase abren particiones y nunca acreditan cobertura por contar páginas',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false}),items=Array.from({length:100},(_,index)=>repo(index+1));
 const first=await f.discovery.discover({request:async()=>response(items,{total:1000})});assert.equal(first.jobStatus,'paged');f.tick();
 const repeated=await f.discovery.discover({request:async()=>response(items,{total:1000})});
 assert.equal(repeated.incomplete,true);assert.equal(repeated.jobStatus,'segmenting');assert.equal(repeated.segmentationPending,true);assert.equal(repeated.coverage.distinctIds,100);assert.equal(repeated.coverage.expectedIds,200);assert.equal(repeated.coverage.overlapIds,100);f.tick();
 const rootFirst=await f.discovery.discover({request:async()=>response(items,{total:1000})});
 assert.equal(rootFirst.shardStatus,'paged');assert.equal(rootFirst.coverage.overlapIds,0);assert.equal(rootFirst.duplicates,100);f.tick();
 const rootRepeated=await f.discovery.discover({request:async()=>response(items,{total:1000})});
 assert.equal(rootRepeated.shardStatus,'split');assert.equal(rootRepeated.splitCreated,2);assert.equal(rootRepeated.segmentationPending,true);assert.equal(rootRepeated.coverage.distinctIds,100);
 const stored=JSON.parse(f.db.prepare('SELECT coverage_json FROM discovery_observations ORDER BY observation_id DESC LIMIT 1').get().coverage_json);assert.equal(stored.overlapIds,100);
 assert.equal(f.db.prepare('SELECT MAX(n) AS n FROM (SELECT COUNT(*) AS n FROM discovery_pass_members GROUP BY pass_id)').get().n,100);
});

test('un día con solape o IDs inválidos queda incompleto con causa explícita, sin cerrar el árbol',async t=>{
 for(const invalid of [false,true]){
  const f=await fixture(t,{singleJob:true,seeded:false}),root=await seedSegments(f),today=new Date(f.time.value).toISOString().slice(0,10);
  f.db.prepare('UPDATE discovery_shards SET start_day=?,end_day=? WHERE shard_id=?').run(today,today,root.shard_id);
  const result=await f.discovery.discover({request:async()=>response([repo(1),invalid?{...repo(2),private:true}:repo(1)],{total:2})});
  assert.equal(result.shardStatus,'incomplete');assert.equal(result.incomplete,true);assert.equal(result.segmentationPending,true);assert.equal(result.saturationReason,'day-resolution');assert.equal(result.coverage.distinctIds,1);assert.equal(result.coverage.expectedIds,2);
  assert.equal(invalid?result.coverage.invalidItems:result.coverage.overlapIds,1);assert.notEqual(result.jobStatus,'segmented');
 }
});

test('refrescar un pase conserva sus miembros históricos y no confunde duplicados globales con solape',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});
 const first=await f.discovery.discover({request:async()=>response([repo(1)])});f.time.value+=METADATA_TTL_MS;
 const refreshed=await f.discovery.discover({request:async()=>response([repo(1)])});
 assert.notEqual(refreshed.coverage.passId,first.coverage.passId);assert.equal(refreshed.coverage.overlapIds,0);assert.equal(refreshed.coverage.distinctIds,1);assert.equal(refreshed.incomplete,false);assert.equal(refreshed.jobStatus,'complete');
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_passes').get().n,2);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_pass_members').get().n,2);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_observations').get().n,2);
});

test('hojas debidas sin resolver preceden al refresco de una hoja complete antigua',async t=>{
 for(const status of ['pending','paged','error','cancelled','incomplete','saturated']){
  const f=await fixture(t,{singleJob:true,seeded:false}),root=await seedSegments(f);await f.discovery.discover({request:async()=>response([])});f.time.value+=3*METADATA_TTL_MS;
  const start=new Date(Date.parse(root.end_day)+86400000).toISOString().slice(0,10),end=new Date(f.time.value).toISOString().slice(0,10);
  f.db.prepare('INSERT INTO discovery_shards(shard_id,job_id,start_day,end_day,depth,status,next_run_ms,created_at) VALUES(?,?,?,?,0,?,?,?)').run('unresolved-'+status,root.job_id,start,end,status,f.time.value,new Date(f.time.value).toISOString());
  const result=await f.discovery.discover({request:async url=>{assert.match(new URL(url).searchParams.get('q'),new RegExp('created:'+start+'\\.\\.'+end+'$'));return response([]);}});
  assert.equal(result.shardId,'unresolved-'+status);assert.equal(f.db.prepare('SELECT attempts FROM discovery_shards WHERE shard_id=?').get(root.shard_id).attempts,1);
 }
});

test('abortar con headers503 o429 o al liberar su body conserva cursor y cuota; reanuda inmediatamente',async t=>{
 for(const shard of [false,true])for(const status of [503,429])for(const abortInBody of [false,true]){
  const f=await fixture(t,{singleJob:true,seeded:false});if(shard)await seedSegments(f);
  const controller=new AbortController();let query,bodyCancelled=0;
  await assert.rejects(f.discovery.discover({signal:controller.signal,request:async url=>{
   query=new URL(url).searchParams.get('q');
   if(!abortInBody)controller.abort(Error('Cancelar headers'));
   return new Response(new ReadableStream({cancel(){bodyCancelled++;if(abortInBody)controller.abort(Error('Cancelar body'));}}),{status,headers:{'Retry-After':'3600','X-RateLimit-Remaining':'0'}});
  }}),/Cancelar/);
  const receipt=f.db.prepare('SELECT * FROM discovery_observations ORDER BY observation_id DESC LIMIT 1').get();assert.equal(receipt.status,'cancelled');assert.equal(receipt.http_status,status);assert.equal(bodyCancelled,1);
  assert.equal(JSON.parse(f.db.prepare("SELECT value FROM library_state WHERE key='githubBackoff'").get().value),null);
  assert.equal(JSON.parse(f.db.prepare("SELECT value FROM library_state WHERE key='githubSearchNextAt'").get().value),f.time.value);
  const resumed=await f.discovery.discover({request:async url=>{assert.equal(new URL(url).searchParams.get('q'),query);assert.equal(new URL(url).searchParams.get('page'),'1');return response([]);}});
  assert.equal(resumed.status,'searched');assert.equal(resumed.coverage.passId,receipt.coverage_pass_id);assert.equal(resumed.coverage.distinctIds,0);
 }
});

test('migrar un cursor antiguo sin pase reinicia página1 conservando observaciones y añade las columnas',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false}),items=Array.from({length:100},(_,index)=>repo(index+1));
 await f.discovery.discover({request:async()=>response(items,{total:130})});f.tick();
 for(const table of ['discovery_jobs','discovery_shards','discovery_observations'])f.db.exec('ALTER TABLE '+table+' DROP COLUMN coverage_pass_id');
 f.db.exec('ALTER TABLE discovery_observations DROP COLUMN coverage_json; DROP TABLE discovery_pass_members; DROP TABLE discovery_passes;');
 const reopened=openRepositoryDiscovery({dbPath:f.dbPath,now:()=>f.time.value});
 try{
  const restart=await reopened.discover({request:async url=>{assert.equal(new URL(url).searchParams.get('page'),'1');return response(items,{total:130});}});assert.equal(restart.coverage.distinctIds,100);assert.equal(restart.incomplete,false);f.tick();
  const last=await reopened.discover({request:async url=>{assert.equal(new URL(url).searchParams.get('page'),'2');return response(Array.from({length:30},(_,index)=>repo(index+101)),{total:130});}});assert.equal(last.jobStatus,'complete');assert.equal(last.coverage.distinctIds,130);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_observations').get().n,3);assert.equal(f.db.prepare('SELECT coverage_pass_id FROM discovery_observations WHERE observation_id=1').get().coverage_pass_id,null);assert.equal(f.db.prepare('PRAGMA user_version').get().user_version,1);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{reopened.close();}
});

test('capacidad canónica detiene expansión sin presentar una partición incompleta como completa',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false,repositoryLimit:2});await seedSegments(f);
 const result=await f.discovery.discover({request:async()=>response([repo(1),repo(2),repo(3)],{total:50000})});
 assert.equal(result.capped,1);assert.equal(result.splitCreated,0);assert.equal(result.shardStatus,'capacity_limited');assert.equal(result.jobStatus,'capacity_limited');assert.equal(result.segmentationPending,true);assert.equal(result.saturationReason,'capacity');assert.equal(f.discovery.summary().repositories,2);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_shards').get().n,1);
});

test('profundidad máxima y presupuesto de nodos son cotas persistentes, sin marcar complete al quedar saturado',async t=>{
 const f=await fixture(t,{singleJob:true,seeded:false});const root=await seedSegments(f);
 f.db.prepare('UPDATE discovery_shards SET depth=? WHERE shard_id=?').run(DISCOVERY_SEGMENT_MAX_DEPTH,root.shard_id);
 const depth=await f.discovery.discover({request:async()=>response([],{total:50000})});assert.equal(depth.shardStatus,'saturated');assert.equal(depth.saturationReason,'max-depth');assert.equal(depth.segmentationPending,true);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_shards').get().n,1);
 f.db.prepare("UPDATE discovery_shards SET depth=0,status='pending',truncated=0,incomplete=0,next_run_ms=0 WHERE shard_id=?").run(root.shard_id);f.db.exec("UPDATE discovery_jobs SET next_run_ms=0 WHERE category_id='CAT-001'");f.tick();
 f.db.exec('BEGIN');const insert=f.db.prepare("INSERT INTO discovery_shards(shard_id,job_id,parent_shard_id,start_day,end_day,depth,status,next_run_ms,created_at) VALUES(?,?,?,?,?,1,'split',?,?)");
 for(let index=1;index<DISCOVERY_SEGMENT_MAX_SHARDS;index++){const start=new Date(Date.parse(DISCOVERY_SEGMENT_START_DAY)+index*86400000).toISOString().slice(0,10);insert.run('budget-'+index,root.job_id,root.shard_id,start,start,f.time.value,new Date(f.time.value).toISOString());}f.db.exec('COMMIT');
 const budget=await f.discovery.discover({request:async()=>response([],{total:50000})});assert.equal(budget.shardStatus,'saturated');assert.equal(budget.saturationReason,'shard-budget');assert.equal(budget.splitCreated,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM discovery_shards').get().n,DISCOVERY_SEGMENT_MAX_SHARDS);
});
