import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openRepositoryLibrary,parseRepositoryCatalog,LIBRARY_TARGETS,METADATA_TTL_MS} from './repo-library.mjs';

const entry=(id,name,url,description='Licencia MIT. Prueba reportada por terceros, sin comprobar.')=>`${id} · ${name}\n${description}\n${url}\n`;
const catalog=[entry('AT-001','Primero','https://github.com/Example/Alpha'),entry('AT-002','Segundo','https://github.com/Example/Beta'),entry('AT-003','Plan gratuito','https://example.org/pricing'),entry('AT-004','Plan educativo','https://example.org/pricing')].join('\n');
const repo=(name='Example/Alpha',license='MIT')=>({id:123,full_name:name,private:false,description:'Descripción publicada por el repositorio',stargazers_count:8,forks_count:2,language:'JavaScript',topics:['testing'],license:{spdx_id:license,name:'MIT License'},archived:false,disabled:false,default_branch:'main',pushed_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-02T00:00:00Z'});
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});

async function temporaryLibrary(t,{text=catalog,clock}={}){
 const directory=await mkdtemp(join(tmpdir(),'atlas-repo-library-'));
 const dbPath=join(directory,'catalog.sqlite');
 const time=clock??{value:Date.parse('2026-10-31T10:00:00Z')};
 const library=openRepositoryLibrary({dbPath,now:()=>time.value});
 if(text)library.importCatalog(text);
 t.after(async()=>{try{library.close();}catch{}assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('atlas-repo-library-'));await rm(directory,{recursive:true,force:true});});
 return {library,time,dbPath};
}

test('import conserva fichas y claims D, deduplica URLs sin inventar progreso',async t=>{
 const {library}=await temporaryLibrary(t);
 const summary=library.summary();
 assert.deepEqual(summary.counts,{entries:4,uniqueUrls:3,repositories:2,metadataVerified:0,elite:0,winners:0,categories:0});
 assert.deepEqual(summary.targets,LIBRARY_TARGETS);
 const items=library.list().items;
 assert.equal(items.length,4);assert.ok(items.every(item=>item.evidence==='D'&&item.verifiedLicense===null&&item.metadata===null));
 assert.match(items[0].rawClaims,/Prueba reportada por terceros/);assert.equal(items[0].licenseClaim,'Licencia MIT');
 assert.equal(items[0].sourceUrl,'https://github.com/Example/Alpha');assert.equal(items[0].url,'https://github.com/example/alpha');
 assert.equal(items[2].url,items[3].url);
 assert.equal(items[0].sourceSha,createHash('sha256').update(catalog).digest('hex'));
 assert.equal(library.importCatalog(catalog).status,'unchanged');assert.equal(library.summary().sources.length,1);
});

test('catálogo persiste al reabrir SQLite y conserva versiones fuente',async t=>{
 const {library,dbPath}=await temporaryLibrary(t);
 const next=catalog.replace('Licencia MIT.','Licencia anunciada BSD-3-Clause.');
 library.importCatalog(next,{sourcePath:'fixture.txt'});
 const reopened=openRepositoryLibrary({dbPath});
 try{assert.equal(reopened.summary().counts.entries,4);assert.equal(reopened.summary().sources.length,2);assert.match(reopened.list().items[0].licenseClaim,/BSD-3-Clause/);}
 finally{reopened.close();}
 const db=new DatabaseSync(dbPath);
 try{assert.equal(db.prepare('SELECT COUNT(*) AS n FROM catalog_versions').get().n,8);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}
 finally{db.close();}
});

test('import es atómico: rollback de todas las fichas si falla una escritura',async t=>{
 const {library,dbPath}=await temporaryLibrary(t,{text:null});
 const db=new DatabaseSync(dbPath);
 db.exec("CREATE TRIGGER reject_second BEFORE INSERT ON catalog_entries WHEN NEW.id='AT-002' BEGIN SELECT RAISE(ABORT,'fallo sintético'); END;");db.close();
 assert.throws(()=>library.importCatalog(catalog),/fallo sintético/);
 assert.equal(library.summary().counts.entries,0);assert.equal(library.summary().counts.uniqueUrls,0);assert.equal(library.summary().sources.length,0);
});

test('constraints impiden IDs y URLs duplicados y fichas sin recurso',async t=>{
 const {dbPath}=await temporaryLibrary(t);
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA foreign_keys=ON;');
 try{
  assert.throws(()=>db.prepare("INSERT INTO resources(url,created_at) VALUES(?,'ahora')").run('https://example.org/pricing'),/UNIQUE/);
  assert.throws(()=>db.exec("UPDATE catalog_entries SET id='AT-001' WHERE id='AT-002'"),/UNIQUE/);
  assert.throws(()=>db.exec("UPDATE catalog_entries SET id='arbitrario' WHERE id='AT-002'"),/CHECK/);
  assert.throws(()=>db.exec("UPDATE catalog_entries SET resource_id=99999 WHERE id='AT-002'"),/FOREIGN KEY/);
 }finally{db.close();}
});

test('parser rechaza fuente mal formada, IDs repetidos y URL con credenciales',()=>{
 assert.throws(()=>parseRepositoryCatalog('Sin fichas'),/No se encontraron/);
 assert.throws(()=>parseRepositoryCatalog(entry('AT-001','Uno','https://github.com/example/one')+entry('AT-001','Dos','https://github.com/example/two')),/duplicado/);
 assert.throws(()=>parseRepositoryCatalog(entry('AT-001','Uno','https://name:secret@example.org/')),/credenciales/);
 assert.throws(()=>parseRepositoryCatalog('AT-001 · Uno\nDescripción sin URL'),/Falta una URL/);
});

test('búsqueda trata comodines como texto y paginación tiene límites',async t=>{
 const {library}=await temporaryLibrary(t);
 const result=library.list({query:'Segundo',limit:1,offset:0});assert.equal(result.total,1);assert.equal(result.items[0].id,'AT-002');
 assert.equal(library.list({query:'%'}).total,0);assert.equal(library.list({limit:5000}).limit,200);
 assert.deepEqual(library.list({limit:1,offset:2}).items.map(item=>item.id),['AT-003']);
 assert.equal(library.list({query:"' OR 1=1 --"}).total,0);
});

test('refresh hace exactamente un GET público, guarda fecha/fuente y licencia API sin elevar D',async t=>{
 const {library,time}=await temporaryLibrary(t);let calls=0;
 const result=await library.refreshNext({request:async(url,options)=>{
  calls++;assert.equal(url,'https://api.github.com/repos/Example/Alpha');assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');
  assert.equal(Object.keys(options.headers).some(key=>key.toLowerCase()==='authorization'),false);
  return response(repo());
 }});
 assert.equal(calls,1);assert.equal(result.status,'verified');
 const item=library.list({query:'Primero'}).items[0];assert.equal(item.verifiedLicense,'MIT');assert.equal(item.evidence,'D');
 assert.equal(item.metadata.stars,8);assert.equal(item.metadataVerifiedAt,new Date(time.value).toISOString());
 assert.equal(item.licenseVerification.sourceUrl,'https://api.github.com/repos/Example/Alpha');
 assert.equal(library.summary().counts.metadataVerified,1);assert.equal(library.summary().counts.elite,0);
});

test('licencias desconocidas no se presentan como verificadas, ni se hereda el claim',async t=>{
 const {library}=await temporaryLibrary(t,{text:entry('AT-001','Uno','https://github.com/Example/Alpha')});
 await library.refreshNext({request:async()=>response(repo('Example/Alpha','NOASSERTION'))});
 const item=library.list().items[0];assert.equal(item.licenseClaim,'Licencia MIT');assert.equal(item.verifiedLicense,null);assert.equal(item.licenseVerification,null);assert.equal(item.evidence,'D');
});

test('TTL24h evita otra petición al mismo repositorio y se renueva tras vencer',async t=>{
 const {library,time}=await temporaryLibrary(t,{text:entry('AT-001','Uno','https://github.com/Example/Alpha')});let calls=0;
 const request=async()=>{calls++;return response(repo());};
 await library.refreshNext({request});time.value+=METADATA_TTL_MS-1;
 assert.equal((await library.refreshNext({request})).status,'cached');assert.equal(calls,1);
 time.value+=1;assert.equal((await library.refreshNext({request})).status,'verified');assert.equal(calls,2);
});

test('403 respeta Retry-After y reset, backoff es global y persistente',async t=>{
 const {library,time,dbPath}=await temporaryLibrary(t);let calls=0;
 const reset=time.value+120000;
 const first=await library.refreshNext({request:async()=>{calls++;return response({},403,{'Retry-After':'30','X-RateLimit-Reset':String(reset/1000)});}});
 assert.equal(first.status,'rate_limited');assert.equal(first.nextRun,new Date(reset+1000).toISOString());
 const again=openRepositoryLibrary({dbPath,now:()=>time.value});
 try{assert.equal((await again.refreshNext({request:async()=>{calls++;throw Error('No debe solicitar');}})).status,'backoff');assert.equal(again.summary().state,'rate_limited');}
 finally{again.close();}
 assert.equal(calls,1);time.value=reset+1001;
 assert.equal((await library.refreshNext({request:async()=>{calls++;return response(repo('Example/Beta'));}})).status,'verified');assert.equal(calls,2);
});

test('429 acepta Retry-After como fecha y no reintenta durante la misma invocación',async t=>{
 const {library,time}=await temporaryLibrary(t);let calls=0;const until=time.value+90000;
 const result=await library.refreshNext({request:async()=>{calls++;return response({},429,{'Retry-After':new Date(until).toUTCString()});}});
 assert.equal(calls,1);assert.equal(result.nextRun,new Date(until+1000).toISOString());assert.equal(result.status,'rate_limited');
});

test('respuesta exitosa con cuota cero bloquea también el siguiente repositorio',async t=>{
 const {library,time}=await temporaryLibrary(t);let calls=0;
 await library.refreshNext({request:async()=>{calls++;return response(repo(),200,{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':String((time.value+60000)/1000)});}});
 const result=await library.refreshNext({request:async()=>{calls++;return response(repo());}});
 assert.equal(calls,1);assert.equal(result.status,'backoff');assert.equal(library.summary().counts.metadataVerified,1);
});

test('404 y redirección conservan evidencia insuficiente sin segunda llamada',async t=>{
 const {library}=await temporaryLibrary(t);let calls=0;
 assert.equal((await library.refreshNext({request:async()=>{calls++;return response({},404);}})).status,'not_found');
 assert.equal((await library.refreshNext({request:async()=>{calls++;return response({},301,{Location:'https://api.github.com/repos/new/repo'});}})).status,'redirect_pending');
 assert.equal(calls,2);assert.equal(library.summary().counts.metadataVerified,0);
});

test('el lease impide consultas concurrentes y fallos permiten continuar otra ficha',async t=>{
 const {library}=await temporaryLibrary(t);let finish;const first=library.refreshNext({request:()=>new Promise(resolve=>{finish=resolve;})});
 assert.equal((await library.refreshNext({request:()=>{throw Error('No debe iniciar');}})).status,'busy');
 finish(response({},500));assert.equal((await first).status,'error');
 assert.equal((await library.refreshNext({request:async()=>response(repo('Example/Beta'))})).status,'verified');
});

test('cancelación no consulta ni deja el lease bloqueado',async t=>{
 const {library}=await temporaryLibrary(t);const pre=new AbortController();pre.abort(Error('Cancelado antes'));
 await assert.rejects(library.refreshNext({signal:pre.signal,request:()=>{throw Error('No debe consultar');}}),/Cancelado antes/);
 const active=new AbortController();
 const pending=library.refreshNext({signal:active.signal,request:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 active.abort(Error('Cancelado durante'));await assert.rejects(pending,/Cancelado durante/);
 assert.notEqual(library.summary().state,'active');
 assert.equal((await library.refreshNext({request:async()=>response(repo())})).status,'verified');
});

test('JSON inválido o cuerpo excesivo no acreditan metadatos ni bloquean otra ficha',async t=>{
 const {library}=await temporaryLibrary(t);
 const invalid=await library.refreshNext({request:async()=>new Response('{broken',{status:200})});
 assert.equal(invalid.status,'error');
 const large=await library.refreshNext({request:async()=>new Response('x'.repeat(1000001),{status:200})});
 assert.equal(large.status,'error');assert.match(large.message,/límite de lectura/);
 assert.equal(library.summary().counts.metadataVerified,0);assert.notEqual(library.summary().state,'active');
});
