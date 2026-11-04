import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {streamRepositoryCsv,REPOSITORY_CSV_COLUMNS,REPOSITORY_CSV_CHUNK_BYTES} from './repository-export.mjs';

const at='2026-11-03T12:00:00.000Z';
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'atlas-export-test-')),dbPath=join(directory,'library.sqlite'),db=new DatabaseSync(dbPath);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=25;
  CREATE TABLE resources(resource_id INTEGER PRIMARY KEY,url TEXT NOT NULL UNIQUE,github_owner TEXT,github_repo TEXT,created_at TEXT NOT NULL,
   metadata_json TEXT,metadata_verified_at TEXT,verified_license TEXT,license_name TEXT,metadata_source_url TEXT,last_checked_ms INTEGER,next_check_ms INTEGER NOT NULL DEFAULT 0,
   verification_status TEXT NOT NULL DEFAULT 'pending',last_error TEXT);
  CREATE TABLE sources(sha256 TEXT PRIMARY KEY,source_path TEXT,imported_at TEXT,raw_text TEXT,entry_count INTEGER);
  CREATE TABLE catalog_entries(id TEXT PRIMARY KEY,name TEXT,description TEXT,source_url TEXT,raw_claims TEXT,license_claim TEXT,source_group TEXT,evidence TEXT,resource_id INTEGER,source_sha TEXT,created_at TEXT,updated_at TEXT);
  INSERT INTO sources VALUES('private-source-sha','C:/private/history.txt','private-import-date','private-source-raw-text',1);`);
 const insert=db.prepare('INSERT INTO resources(resource_id,url,github_owner,github_repo,created_at,metadata_json,metadata_verified_at,verified_license,license_name,metadata_source_url,last_checked_ms,verification_status,last_error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
 const add=(id,overrides={})=>{
  const repo='repository-'+id;
  const values={url:'https://github.com/example/'+repo,owner:'example',repo,createdAt:at,metadata:{fullName:'example/'+repo,description:'Descripción pública '+id,language:'JavaScript',topics:['testing'],stars:3,forks:1,archived:false,disabled:false,defaultBranch:'main',pushedAt:at,updatedAt:at,license:{spdxId:'MIT',name:'MIT License'},apiKey:'private-json-secret',rawClaims:'private-json-raw-claims'},verifiedAt:at,license:'MIT',licenseName:'MIT License',source:'https://api.github.com/repos/example/'+repo,checkedAt:Date.parse(at),status:'verified',...overrides};
  insert.run(id,values.url,values.owner,values.repo,values.createdAt,typeof values.metadata==='string'?values.metadata:JSON.stringify(values.metadata),values.verifiedAt,values.license,values.licenseName,values.source,values.checkedAt,values.status,'private-error-secret');
 };
 const claim=(id,licenseClaim='Licencia BSD reportada, sin verificar.')=>db.prepare('INSERT INTO catalog_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('AT-'+String(id).padStart(3,'0'),'private-imported-name','private-imported-description','https://github.com/example/repository-'+id,'private-raw-claims',licenseClaim,'private-source-group','D',id,'private-source-sha',at,at);
 t.after(async()=>{try{db.close();}catch{}assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('atlas-export-test-'));await rm(directory,{recursive:true,force:true});});
 return {directory,dbPath,db,add,claim};
}
async function collect(options){let result='';for await(const chunk of streamRepositoryCsv(options))result+=chunk;return result;}
// Independent CSV reader for assertions, including quoted record newlines.
function parseCsv(csv){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if(c==='\r'&&csv[i+1]==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';i++;}
  else cell+=c;
 }
 assert.equal(quoted,false);assert.equal(cell,'');assert.equal(row.length,0);return rows;
}
const objects=csv=>{const [header,...rows]=parseCsv(csv);assert.deepEqual(header,REPOSITORY_CSV_COLUMNS);return rows.map(row=>{assert.equal(row.length,header.length);return Object.fromEntries(header.map((key,index)=>[key,row[index]]));});};
function checkpoint(db){return db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();}

test('exports only public GitHub metadata with separate unverified license claims and public provenance',async t=>{
 const {dbPath,db,add,claim}=await fixture(t);add(1);claim(1);add(2,{source:'https://api.github.com/search/repositories?q=private-search-token&page=1',verifiedAt:null,license:null,status:'discovered'});add(3,{url:'https://example.org/private',owner:null,repo:null});add(4,{metadata:{private:true,description:'private-repository-secret'}});
 const csv=await collect({dbPath}),rows=objects(csv);assert.equal(rows.length,2);
 assert.equal(rows[0].repository,'example/repository-1');assert.equal(rows[0].license_claim,'Licencia BSD reportada, sin verificar.');assert.equal(rows[0].license_claim_status,'imported_unverified');assert.equal(rows[0].license_spdx_metadata,'MIT');assert.equal(rows[0].license_metadata_basis,'github-rest-spdx-metadata');assert.equal(rows[0].license_full_text_verified,'false');assert.equal(rows[0].metadata_verified_at,at);
 assert.equal(rows[1].metadata_source_url,'https://api.github.com/search/repositories');assert.equal(rows[1].license_metadata_basis,'github-search-spdx-metadata');assert.equal(rows[1].metadata_observed_at,at);assert.equal(rows[1].metadata_verified_at,'');
 assert.doesNotMatch(csv,/private|source_path|raw_claims|apiKey|rawClaims|history|source-sha/);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});

test('a BEGIN read snapshot stays consistent while another connection updates and inserts resources',async t=>{
 const {dbPath,db,add}=await fixture(t);add(1);add(2);
 const iterator=streamRepositoryCsv({dbPath});const header=await iterator.next();assert.equal(header.done,false);
 db.prepare('UPDATE resources SET metadata_json=? WHERE resource_id=1').run(JSON.stringify({description:'new writer description'}));add(3);
 let csv=header.value;for await(const chunk of iterator)csv+=chunk;
 const rows=objects(csv);assert.equal(rows.length,2);assert.equal(rows[0].description,'Descripción pública 1');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM resources').get().n,3);assert.equal(checkpoint(db).busy,0);
});

test('Unicode, commas, quotes and embedded newlines survive CSV encoding',async t=>{
 const {dbPath,add,claim}=await fixture(t);const description='Investigación, "música"\r\nLínea española 🙂 日本語';
 add(1,{metadata:{description,language:'C++, "Rust"',topics:['señales','日本語'],stars:0,forks:0}});claim(1,'MIT, "según fuente"\npendiente');
 const csv=await collect({dbPath}),[row]=objects(csv);assert.equal(row.description,description);assert.equal(row.language,'C++, "Rust"');assert.equal(row.license_claim,'MIT, "según fuente"\npendiente');assert.equal(row.topics,'señales | 日本語');assert.equal(row.stars,'0');assert.match(csv,/""música""/);
});

test('spreadsheet formulas remain text even after whitespace, control and Unicode prefixes',async t=>{
 const {dbPath,add,claim}=await fixture(t);
 const values=['=HYPERLINK("https://evil/","click")','+SUM(1,2)','-1+2','@SUM(A1)',' \t=1+1','\tplain control','\r\n=1','\uFEFF=1','\u200B=1'];
 for(let index=0;index<values.length;index++){add(index+1,{metadata:{description:values[index]}});claim(index+1,values[index]);}
 const rows=objects(await collect({dbPath}));assert.deepEqual(rows.map(row=>row.description),values.map(value=>"'"+value));assert.deepEqual(rows.map(row=>row.license_claim),values.map(value=>"'"+value));
});

test('chunks, metadata fields and row limits stay bounded while respecting iterator backpressure',async t=>{
 const {dbPath,db,add}=await fixture(t);
 db.exec('BEGIN');for(let index=1;index<=160;index++)add(index,{metadata:{description:'🙂'.repeat(4000),topics:Array.from({length:50},()=> '字'.repeat(100))}});db.exec('COMMIT');
 let chunks=0,totalRows=0;
 for await(const chunk of streamRepositoryCsv({dbPath,maxRows:40})){chunks++;assert.ok(Buffer.byteLength(chunk)<=REPOSITORY_CSV_CHUNK_BYTES);if(chunks>1)totalRows+=parseCsv(chunk).length;}
 assert.equal(totalRows,40);assert.ok(chunks>2);assert.equal(checkpoint(db).busy,0);
});

test('early iterator return and abort while suspended release the snapshot immediately',async t=>{
 const {dbPath,db,add}=await fixture(t);add(1);add(2);
 const early=streamRepositoryCsv({dbPath});await early.next();add(3);assert.equal(checkpoint(db).busy,1);await early.return();assert.equal(checkpoint(db).busy,0);
 const controller=new AbortController(),aborted=streamRepositoryCsv({dbPath,signal:controller.signal});await aborted.next();add(4);assert.equal(checkpoint(db).busy,1);
 const reason=Error('cancelled export');controller.abort(reason);assert.equal(checkpoint(db).busy,0);await assert.rejects(aborted.next(),error=>error===reason);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});

test('deadline closes an idle export snapshot even when the consumer stops requesting chunks',async t=>{
 const {dbPath,db,add}=await fixture(t);add(1);
 const iterator=streamRepositoryCsv({dbPath,timeoutMs:250});await iterator.next();add(2);await new Promise(resolve=>setTimeout(resolve,350));assert.equal(checkpoint(db).busy,0);await assert.rejects(iterator.next(),error=>error.code==='export_timeout');
});

test('read-only export preserves database bytes and integrity without initialization or writes',async t=>{
 const {dbPath,db,add}=await fixture(t);add(1);checkpoint(db);
 const hash=async()=>createHash('sha256').update(await readFile(dbPath)).digest('hex');const before=await hash(),mtime=(await stat(dbPath)).mtimeMs;
 await collect({dbPath});assert.equal(await hash(),before);assert.equal((await stat(dbPath)).mtimeMs,mtime);assert.equal(checkpoint(db).busy,0);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});

test('invalid identities, source URLs, oversized JSON and raw error strings cannot enter the export',async t=>{
 const {dbPath,add}=await fixture(t);
 add(1,{source:'https://user:private-secret@api.github.com/repos/example/repository-1',metadata:{description:'public',license:{spdxId:'MIT'}}});add(2,{url:'https://github.com/another/repository'});add(3,{metadata:'{"private-secret":"'+'x'.repeat(70000)+'"}'});add(4,{metadata:'not-json-private-secret',status:'private-secret'});
 const csv=await collect({dbPath}),rows=objects(csv);assert.equal(rows.length,3);assert.equal(rows[0].metadata_source_url,'');assert.equal(rows[0].license_spdx_metadata,'');assert.equal(rows[1].description,'');assert.equal(rows[2].verification_status,'unknown');assert.doesNotMatch(csv,/private-secret|another/);
});

test('invalid bounds, missing files and pre-cancellation never create a database',async t=>{
 const {directory,dbPath}=await fixture(t),missing=join(directory,'does-not-exist.sqlite');
 for(const patch of [{maxRows:0},{maxRows:100001},{maxRows:1.2},{timeoutMs:0},{timeoutMs:30001},{dbPath:':memory:'},{url:'https://evil/'}])await assert.rejects(collect({dbPath,...patch}),TypeError);
 await assert.rejects(collect({dbPath:missing}),error=>error.code==='database_unavailable');await assert.rejects(stat(missing),error=>error.code==='ENOENT');
 const controller=new AbortController(),reason=Error('cancel before open');controller.abort(reason);await assert.rejects(collect({dbPath:missing,signal:controller.signal}),error=>error===reason);await assert.rejects(stat(missing),error=>error.code==='ENOENT');
});
