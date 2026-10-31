import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {openRepositoryLibrary,METADATA_TTL_MS} from './repo-library.mjs';
import {openRepositoryDiscovery,loadRepositoryTaxonomy,DISCOVERY_INTERVAL_MS} from './repository-discovery.mjs';

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

test('tope1000: nunca solicita página11 y no cuenta repetidos como progreso',async t=>{
 const {discovery,tick,db}=await fixture(t,{singleJob:true,seeded:false});let calls=0;
 const items=Array.from({length:100},(_,index)=>repo(index+1));
 for(let page=1;page<=10;page++){
  const result=await discovery.discover({request:async url=>{calls++;assert.equal(Number(new URL(url).searchParams.get('page')),page);return response(items,{total:50000});}});
  assert.equal(result.truncated,true);assert.equal(result.added,page===1?100:0);tick();
 }
 assert.equal(calls,10);assert.equal(discovery.summary().discovered,100);
 const job=db.prepare("SELECT * FROM discovery_jobs WHERE category_id='CAT-001'").get();assert.equal(job.status,'truncated');assert.equal(job.next_page,10);assert.equal(job.total_count,50000);
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
 assert.equal(result.incomplete,true);assert.equal(result.jobStatus,'incomplete');assert.equal(discovery.summary().validatedCategories,0);
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
