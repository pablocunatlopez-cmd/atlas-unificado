import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,join,relative,resolve} from 'node:path';
import {backupRepositoryLibrary} from './backup-library.mjs';

async function workspace(t){
 const root=await mkdtemp(join(tmpdir(),'atlas-library-backup-test-'));
 const sourcePath=join(root,'source.sqlite'),outputDir=join(root,'backups');
 const writer=new DatabaseSync(sourcePath);
 writer.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; PRAGMA foreign_keys=ON; CREATE TABLE resources(id INTEGER PRIMARY KEY,url TEXT UNIQUE); CREATE TABLE catalog_entries(id TEXT PRIMARY KEY,resource_id INTEGER REFERENCES resources(id)); PRAGMA user_version=1;");
 t.after(async()=>{try{writer.close();}catch{}assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('atlas-library-backup-test-'));await rm(root,{recursive:true,force:true});});
 return {root,sourcePath,outputDir,writer};
}

test('backup incluye commits aún en WAL con escritor abierto y manifiesto verificable',async t=>{
 const {sourcePath,outputDir,writer}=await workspace(t);
 writer.exec("INSERT INTO resources VALUES(1,'https://github.com/example/one'); INSERT INTO catalog_entries VALUES('AT-001',1); PRAGMA wal_checkpoint(TRUNCATE);");
 writer.exec("INSERT INTO resources VALUES(2,'https://github.com/example/two'); INSERT INTO catalog_entries VALUES('AT-002',2);");
 assert.ok((await stat(sourcePath+'-wal')).size>0);
 const result=await backupRepositoryLibrary({sourcePath,outputDir});
 assert.equal(result.status,'verified');assert.equal(result.integrity,'ok');assert.equal(result.foreignKeyViolations,0);
 assert.equal(result.tables.resources,2);assert.equal(result.tables.catalog_entries,2);
 assert.equal(relative(outputDir,result.path).startsWith('..'),false);
 const manifest=JSON.parse(await readFile(result.manifestPath,'utf8'));
 const bytes=await readFile(result.path);
 assert.equal(manifest.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(result.sha256,manifest.sha256);assert.equal(manifest.bytes,bytes.length);
 assert.equal(manifest.method,'node:sqlite.backup');assert.equal(manifest.sourceOpenedReadOnly,true);
 assert.equal(manifest.integrity,'ok');assert.equal(manifest.tables.resources,2);
 const snapshot=new DatabaseSync(result.path,{readOnly:true});
 try{
  assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal(snapshot.prepare('PRAGMA journal_mode').get().journal_mode,'delete');
  assert.deepEqual(snapshot.prepare('SELECT id FROM catalog_entries ORDER BY id').all().map(row=>row.id),['AT-001','AT-002']);
 }finally{snapshot.close();}
 assert.equal(writer.prepare('PRAGMA journal_mode').get().journal_mode,'wal');
 assert.deepEqual((await readdir(result.directory)).sort(),['manifest.json','repo-library.sqlite']);
});

test('copias sucesivas son únicas, conservan la anterior y cada una refleja sus commits',async t=>{
 const {sourcePath,outputDir,writer}=await workspace(t);
 writer.exec("INSERT INTO resources VALUES(1,'https://github.com/example/one');");
 const first=await backupRepositoryLibrary({sourcePath,outputDir});
 writer.exec("INSERT INTO resources VALUES(2,'https://github.com/example/two');");
 const second=await backupRepositoryLibrary({sourcePath,outputDir});
 assert.notEqual(first.path,second.path);assert.notEqual(first.directory,second.directory);
 assert.equal(first.tables.resources,1);assert.equal(second.tables.resources,2);
 assert.equal(createHash('sha256').update(await readFile(first.path)).digest('hex'),first.sha256);
 assert.equal((await readdir(outputDir)).length,2);
});

test('el respaldo excluye cambios sin commit del escritor',async t=>{
 const {sourcePath,outputDir,writer}=await workspace(t);
 writer.exec("INSERT INTO resources VALUES(1,'https://github.com/example/one'); BEGIN IMMEDIATE; INSERT INTO resources VALUES(2,'https://github.com/example/two');");
 try{
  const result=await backupRepositoryLibrary({sourcePath,outputDir});
  assert.equal(result.tables.resources,1);assert.equal(writer.prepare('SELECT COUNT(*) AS n FROM resources').get().n,2);
 }finally{writer.exec('ROLLBACK');}
});

test('origen ausente no crea una falsa copia verificada',async t=>{
 const {root,outputDir}=await workspace(t);
 await assert.rejects(backupRepositoryLibrary({sourcePath:join(root,'missing.sqlite'),outputDir}),/ENOENT/);
 await assert.rejects(stat(outputDir),/ENOENT/);
});
