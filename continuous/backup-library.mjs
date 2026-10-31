import {DatabaseSync,backup} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,mkdtemp,open,realpath,rename,stat} from 'node:fs/promises';
import {dirname,join,relative,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_LIBRARY_PATH} from './repo-library.mjs';

export const DEFAULT_BACKUP_DIRECTORY=join(dirname(DEFAULT_LIBRARY_PATH),'backups');

function assertWithin(directory,target){
 const child=relative(resolve(directory),resolve(target));
 if(!child||child==='..'||child.startsWith('..\\')||child.startsWith('../')||isAbsolute(child))throw Error('La salida del respaldo debe estar dentro de su directorio reservado.');
}

async function sha256File(path){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(path))hash.update(chunk);
 return hash.digest('hex');
}

function inspectSnapshot(path){
 // The new snapshot may inherit WAL mode. Normalize this destination only so
 // the final artifact is one standalone SQLite file, with no sidecar dependency.
 const db=new DatabaseSync(path);
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
  const journalMode=db.prepare('PRAGMA journal_mode=DELETE').get().journal_mode;
  if(journalMode!=='delete')throw Error('No se pudo consolidar el respaldo como un archivo SQLite independiente.');
  const rows=db.prepare('PRAGMA integrity_check').all();
  if(rows.length!==1||rows[0].integrity_check!=='ok')throw Error('La comprobación de integridad del respaldo no es correcta.');
  const violations=db.prepare('PRAGMA foreign_key_check').all();
  if(violations.length)throw Error('El respaldo contiene relaciones de base de datos inconsistentes.');
  const tables={};
  for(const {name} of db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
   tables[name]=db.prepare('SELECT COUNT(*) AS count FROM "'+name.replaceAll('"','""')+'"').get().count;
  }
  return {integrity:'ok',foreignKeyViolations:0,journalMode,tables,
   schemaVersion:db.prepare('PRAGMA user_version').get().user_version,
   pageCount:db.prepare('PRAGMA page_count').get().page_count,
   pageSize:db.prepare('PRAGMA page_size').get().page_size};
 }finally{db.close();}
}

/** Consistent SQLite backup; never copies or checkpoints the source WAL/SHM. */
export async function backupRepositoryLibrary({sourcePath=DEFAULT_LIBRARY_PATH,outputDir=DEFAULT_BACKUP_DIRECTORY}={}){
 if(typeof backup!=='function')throw Error('Esta versión de Node no ofrece node:sqlite.backup.');
 const source=await realpath(resolve(sourcePath));
 if(!(await stat(source)).isFile())throw Error('El origen del respaldo debe ser un archivo SQLite.');
 const startedAt=new Date().toISOString();
 await mkdir(resolve(outputDir),{recursive:true});
 const parent=await realpath(resolve(outputDir));
 const directory=await mkdtemp(join(parent,'repo-library-'+startedAt.replaceAll(':','-').replaceAll('.','-')+'-'));
 const stagingPath=join(directory,'snapshot.partial.sqlite'),path=join(directory,'repo-library.sqlite'),manifestPath=join(directory,'manifest.json');
 for(const target of [directory,stagingPath,path,manifestPath])assertWithin(parent,target);
 for(const target of [stagingPath,path,manifestPath])assertWithin(directory,target);
 const origin=new DatabaseSync(source,{readOnly:true});
 let pagesCopied;
 try{pagesCopied=await backup(origin,stagingPath);}
 finally{origin.close();}
 const inspection=inspectSnapshot(stagingPath);
 const bytes=(await stat(stagingPath)).size,sha256=await sha256File(stagingPath);
 // Both absolute paths have been checked under the newly reserved directory.
 // No existing backup is overwritten or removed.
 await rename(stagingPath,path);
 const completedAt=new Date().toISOString();
 const manifest={version:1,status:'verified',method:'node:sqlite.backup',sourcePath:source,sourceOpenedReadOnly:true,
  startedAt,completedAt,snapshotFile:'repo-library.sqlite',bytes,sha256,pagesCopied,...inspection};
 const handle=await open(manifestPath,'wx');
 try{await handle.writeFile(JSON.stringify(manifest,null,2)+'\n','utf8');await handle.sync();}
 finally{await handle.close();}
 return {status:'verified',path,manifestPath,directory,sourcePath:source,createdAt:completedAt,bytes,sha256,pagesCopied,...inspection};
}

const invokedPath=process.argv[1]?resolve(process.argv[1]):'';
const modulePath=fileURLToPath(import.meta.url);
const direct=process.platform==='win32'?invokedPath.toLowerCase()===modulePath.toLowerCase():invokedPath===modulePath;
if(direct){
 try{console.log(JSON.stringify(await backupRepositoryLibrary({sourcePath:process.argv[2]||DEFAULT_LIBRARY_PATH,outputDir:process.argv[3]||DEFAULT_BACKUP_DIRECTORY}),null,2));}
 catch(error){console.error('No se completó un respaldo verificado: '+error.message);process.exitCode=1;}
}
