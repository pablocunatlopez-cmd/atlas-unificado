import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const LIBRARY_TARGETS=Object.freeze({repositories:100000,elite:1000,winners:250});
export const METADATA_TTL_MS=24*60*60*1000;
export const DEFAULT_LIBRARY_PATH=fileURLToPath(new URL('./data/repo-library.sqlite',import.meta.url));
const iso=value=>value==null?null:new Date(value).toISOString();
const digest=text=>createHash('sha256').update(text).digest('hex');
const githubOwner=/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/;
const githubRepo=/^[a-zA-Z0-9_.-]{1,100}$/;
const reservedOwners=new Set(['topics','orgs','organizations','search','settings','login','marketplace','collections','features','sponsors','about','pricing','site']);

function resourceDescriptor(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('El catálogo solo admite URL HTTPS sin credenciales ni puertos personalizados.');
 url.hash='';
 const parts=url.pathname.split('/').filter(Boolean);
 let owner=null,repo=null;
 if(url.hostname==='github.com'&&parts.length>=2&&!reservedOwners.has(parts[0].toLowerCase())){
  owner=parts[0];repo=parts[1].replace(/\.git$/i,'');
  if(!githubOwner.test(owner)||!githubRepo.test(repo)||repo==='.'||repo==='..')throw Error('Identificador GitHub inválido.');
  return {url:`https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`,owner,repo};
 }
 return {url:url.href,owner,repo};
}

// Imported prose is a set of claims, not proof of licenses, tests or installations.
export function parseRepositoryCatalog(text){
 if(typeof text!=='string'||!text.trim())throw Error('La fuente del catálogo está vacía.');
 const headings=[...text.matchAll(/^AT-(\d{3})\s*·\s*([^\r\n]+)\r?$/gm)];
 if(!headings.length)throw Error('No se encontraron fichas AT-###.');
 const seen=new Set();
 return headings.map((match,index)=>{
  const id='AT-'+match[1];if(seen.has(id))throw Error('ID de ficha duplicado: '+id);seen.add(id);
  const body=text.slice(match.index+match[0].length,headings[index+1]?.index??text.length);
  const link=/^\s*(https:\/\/[^\s<>"']+)\s*$/m.exec(body);
  if(!link)throw Error('Falta una URL pública en '+id);
  const sourceUrl=link[1],descriptor=resourceDescriptor(sourceUrl);
  const description=body.slice(0,link.index).trim();
  if(!description)throw Error('Falta la descripción de '+id);
  const firstSentence=description.split(/\.\s/)[0];
  const licenseClaim=/licencia|\b(?:MIT|BSD|Apache|GPL|AGPL|LGPL|MPL|CC0|CC-BY)\b|dominio p[uú]blico|propietari|SaaS/i.test(firstSentence)?firstSentence:null;
  const before=text.slice(0,match.index);
  const groups=[...before.matchAll(/^([A-Z])\.\s+(.+?)\s+—\s+AT-\d{3}[^\r\n]*$/gm)];
  const complementary=before.lastIndexOf('REPOSITORIOS COMPLEMENTARIOS ANALIZADOS');
  const group=groups.at(-1);
  const sourceGroup=complementary>(group?.index??-1)?'REPOSITORIOS COMPLEMENTARIOS':group?.[2]??null;
  return {id,name:match[2].trim(),description,sourceUrl,...descriptor,licenseClaim,sourceGroup,
   rawClaims:match[0]+'\n'+body.slice(0,link.index+link[0].length).trim(),evidence:'D'};
 });
}

const schema=`
CREATE TABLE IF NOT EXISTS sources (
 sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64), source_path TEXT,
 imported_at TEXT NOT NULL, raw_text TEXT NOT NULL, entry_count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS resources (
 resource_id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE,
 github_owner TEXT, github_repo TEXT,
 created_at TEXT NOT NULL, metadata_json TEXT, metadata_verified_at TEXT,
 verified_license TEXT, license_name TEXT, metadata_source_url TEXT,
 last_checked_ms INTEGER, next_check_ms INTEGER NOT NULL DEFAULT 0,
 verification_status TEXT NOT NULL DEFAULT 'pending', last_error TEXT,
 CHECK((github_owner IS NULL)=(github_repo IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS resource_github_identity ON resources(lower(github_owner),lower(github_repo)) WHERE github_owner IS NOT NULL;
CREATE TABLE IF NOT EXISTS catalog_entries (
 id TEXT PRIMARY KEY CHECK(id GLOB 'AT-[0-9][0-9][0-9]'), name TEXT NOT NULL,
 description TEXT NOT NULL, source_url TEXT NOT NULL, raw_claims TEXT NOT NULL,
 license_claim TEXT, source_group TEXT, evidence TEXT NOT NULL DEFAULT 'D' CHECK(evidence='D'),
 resource_id INTEGER NOT NULL REFERENCES resources(resource_id),
 source_sha TEXT NOT NULL REFERENCES sources(sha256), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_versions (
 source_sha TEXT NOT NULL REFERENCES sources(sha256), catalog_id TEXT NOT NULL,
 resource_id INTEGER NOT NULL REFERENCES resources(resource_id), raw_claims TEXT NOT NULL,
 PRIMARY KEY(source_sha,catalog_id)
);
CREATE TABLE IF NOT EXISTS observations (
 observation_id INTEGER PRIMARY KEY, resource_id INTEGER NOT NULL REFERENCES resources(resource_id),
 checked_at TEXT NOT NULL, source_url TEXT NOT NULL, method TEXT NOT NULL,
 status TEXT NOT NULL, http_status INTEGER, raw_json TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS library_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS resource_refresh_queue ON resources(next_check_ms,last_checked_ms);
PRAGMA user_version=1;
`;

function parseJson(value,fallback=null){try{return JSON.parse(value);}catch{return fallback;}}
function usefulSpdx(value){
 return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9.+-]{0,80}$/.test(value)&&!['NOASSERTION','NONE','UNKNOWN','OTHER'].includes(value.toUpperCase())&&!/^LicenseRef-/i.test(value)?value:null;
}
function normalizeMetadata(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Number.isSafeInteger(raw.id)||raw.id<1||typeof raw.full_name!=='string'||raw.private===true)throw Error('GitHub devolvió metadatos públicos no válidos.');
 const parts=raw.full_name.split('/');
 if(parts.length!==2||!githubOwner.test(parts[0])||!githubRepo.test(parts[1]))throw Error('GitHub devolvió una identidad de repositorio no válida.');
 const spdxId=usefulSpdx(raw.license?.spdx_id);
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
 const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
 return {githubId:raw.id,fullName:raw.full_name,description:typeof raw.description==='string'?raw.description.slice(0,4000):null,
  htmlUrl:`https://github.com/${parts[0]}/${parts[1]}`,stars:count(raw.stargazers_count),forks:count(raw.forks_count),
  language:typeof raw.language==='string'?raw.language.slice(0,100):null,
  topics:Array.isArray(raw.topics)?raw.topics.filter(t=>typeof t==='string').slice(0,50).map(t=>t.slice(0,100)):[],
  archived:typeof raw.archived==='boolean'?raw.archived:null,disabled:typeof raw.disabled==='boolean'?raw.disabled:null,
  defaultBranch:typeof raw.default_branch==='string'?raw.default_branch.slice(0,200):null,
  pushedAt:date(raw.pushed_at),updatedAt:date(raw.updated_at),
  license:spdxId?{spdxId,name:typeof raw.license.name==='string'?raw.license.name.slice(0,200):null}:null};
}

function backoffFromHeaders(headers,now){
 const retry=headers?.get?.('retry-after');
 const candidates=[];
 if(retry){const seconds=Number(retry);const until=Number.isFinite(seconds)?now+Math.max(0,seconds)*1000:Date.parse(retry);if(Number.isFinite(until)&&until>=now)candidates.push(until);}
 const reset=Number(headers?.get?.('x-ratelimit-reset'))*1000;
 if(Number.isFinite(reset)&&reset>now)candidates.push(reset);
 return (candidates.length?Math.max(...candidates):now+60*60*1000)+1000;
}

async function metadataBody(response,signal){
 const limit=1000000;
 if(response.body?.getReader){
  const reader=response.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
  try{
   while(true){
    signal.throwIfAborted();const chunk=await reader.read();signal.throwIfAborted();
    if(chunk.done)return text+decoder.decode();
    bytes+=chunk.value.byteLength;if(bytes>limit)throw Error('Los metadatos superan el límite de lectura.');
    text+=decoder.decode(chunk.value,{stream:true});
   }
  }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
 }
 const text=typeof response.text==='function'?await response.text():JSON.stringify(await response.json());
 if(typeof text!=='string'||Buffer.byteLength(text)>limit)throw Error('Los metadatos superan el límite de lectura.');
 return text;
}

export function openRepositoryLibrary({dbPath=DEFAULT_LIBRARY_PATH,now=Date.now}={}){
 if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
 const db=new DatabaseSync(dbPath);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 const version=db.prepare('PRAGMA user_version').get().user_version;
 if(version>1){db.close();throw Error('La biblioteca usa una versión de esquema más nueva.');}
 try{db.exec('BEGIN IMMEDIATE;'+schema+'COMMIT;');}catch(error){try{db.exec('ROLLBACK');}catch{}db.close();throw error;}
 const getState=(key,fallback=null)=>parseJson(db.prepare('SELECT value FROM library_state WHERE key=?').get(key)?.value,fallback);
 const setState=(key,value)=>db.prepare('INSERT INTO library_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
 const transaction=work=>{db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 setState('targets',LIBRARY_TARGETS);

 function importCatalog(text,{sourcePath=null,expectedEntries}={}){
  const entries=parseRepositoryCatalog(text),sourceSha=digest(text),at=iso(now());
  if(expectedEntries!==undefined&&entries.length!==expectedEntries)throw Error(`Se esperaban ${expectedEntries} fichas y se encontraron ${entries.length}.`);
  return transaction(()=>{
   if(db.prepare('SELECT 1 FROM sources WHERE sha256=?').get(sourceSha))return {status:'unchanged',imported:0,entries:entries.length,sourceSha,message:'Esta fuente ya estaba importada.'};
   db.prepare('INSERT INTO sources(sha256,source_path,imported_at,raw_text,entry_count) VALUES(?,?,?,?,?)').run(sourceSha,sourcePath,at,text,entries.length);
   const insertResource=db.prepare('INSERT INTO resources(url,github_owner,github_repo,created_at,verification_status) VALUES(?,?,?,?,?) ON CONFLICT(url) DO NOTHING');
   const resourceId=db.prepare('SELECT resource_id FROM resources WHERE url=?');
   const upsert=db.prepare(`INSERT INTO catalog_entries(id,name,description,source_url,raw_claims,license_claim,source_group,resource_id,source_sha,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,source_url=excluded.source_url,raw_claims=excluded.raw_claims,license_claim=excluded.license_claim,source_group=excluded.source_group,resource_id=excluded.resource_id,source_sha=excluded.source_sha,updated_at=excluded.updated_at`);
   const versionRow=db.prepare('INSERT INTO catalog_versions(source_sha,catalog_id,resource_id,raw_claims) VALUES(?,?,?,?)');
   for(const entry of entries){
    insertResource.run(entry.url,entry.owner,entry.repo,at,entry.owner?'pending':'reference');
    const resource=resourceId.get(entry.url).resource_id;
    upsert.run(entry.id,entry.name,entry.description,entry.sourceUrl,entry.rawClaims,entry.licenseClaim,entry.sourceGroup,resource,sourceSha,at,at);
    versionRow.run(sourceSha,entry.id,resource,entry.rawClaims);
   }
   setState('lastImport',{at,sourceSha,entries:entries.length});
   return {status:'imported',imported:entries.length,entries:entries.length,sourceSha,message:`${entries.length} fichas importadas como afirmaciones sin verificar.`};
  });
 }

 function summary(){
  const instant=now(),backoff=getState('githubBackoff'),lease=getState('githubLease');
  const count=sql=>db.prepare(sql).get().count;
  const queue=db.prepare('SELECT MIN(next_check_ms) AS next FROM resources WHERE github_owner IS NOT NULL').get();
  const next=Math.max(queue.next??instant,backoff?.until??0,lease?.until??0,instant);
  return {counts:{entries:count('SELECT COUNT(*) AS count FROM catalog_entries'),uniqueUrls:count('SELECT COUNT(*) AS count FROM resources'),
   repositories:count('SELECT COUNT(*) AS count FROM resources WHERE github_owner IS NOT NULL'),metadataVerified:count('SELECT COUNT(*) AS count FROM resources WHERE metadata_verified_at IS NOT NULL'),
   elite:0,winners:0,categories:0},targets:{...LIBRARY_TARGETS},lastRun:getState('lastRun'),nextRun:queue.next==null?null:iso(next),lastError:getState('lastError'),
   lastImport:getState('lastImport'),backoffUntil:backoff?.until>instant?iso(backoff.until):null,
   state:backoff?.until>instant?'rate_limited':lease?.until>instant?'active':'ready',
   metadataTtlHours:24,evidenceNotice:'D: las afirmaciones importadas siguen sin verificar. Metadatos de GitHub no equivalen a pruebas de código, licencia completa, evaluación ni selección.',
   sources:db.prepare('SELECT sha256,source_path AS sourcePath,imported_at AS importedAt,entry_count AS entries FROM sources ORDER BY imported_at DESC').all()};
 }

 function list({query='',limit=40,offset=0}={}){
  limit=Number.isInteger(Number(limit))?Math.max(1,Math.min(200,Number(limit))):40;
  offset=Number.isInteger(Number(offset))?Math.max(0,Math.min(1000000,Number(offset))):0;
  const term=String(query).trim().slice(0,300).replace(/[\\%_]/g,'\\$&'),filter='%'+term+'%';
  const where="WHERE (?='' OR e.id LIKE ? ESCAPE '\\' OR e.name LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\' OR r.url LIKE ? ESCAPE '\\')";
  const args=[term,filter,filter,filter,filter];
  const total=db.prepare(`SELECT COUNT(*) AS count FROM catalog_entries e JOIN resources r USING(resource_id) ${where}`).get(...args).count;
  const rows=db.prepare(`SELECT e.*,r.url,r.github_owner,r.github_repo,r.metadata_json,r.metadata_verified_at,r.verified_license,r.license_name,r.metadata_source_url,r.verification_status,r.last_error,r.last_checked_ms,r.next_check_ms FROM catalog_entries e JOIN resources r USING(resource_id) ${where} ORDER BY e.id LIMIT ? OFFSET ?`).all(...args,limit,offset);
  return {total,limit,offset,items:rows.map(row=>({id:row.id,name:row.name,url:row.url,sourceUrl:row.source_url,description:row.description,rawClaims:row.raw_claims,
   owner:row.github_owner,repo:row.github_repo,licenseClaim:row.license_claim,verifiedLicense:row.verified_license,evidence:row.evidence,sourceGroup:row.source_group,category:null,
   sourceSha:row.source_sha,importedAt:row.created_at,metadataVerifiedAt:row.metadata_verified_at,metadata:parseJson(row.metadata_json),verificationStatus:row.verification_status,
   lastError:row.last_error,lastCheckedAt:iso(row.last_checked_ms),nextCheckAt:row.github_owner?iso(row.next_check_ms):null,
   licenseVerification:row.verified_license?{sourceUrl:row.metadata_source_url,verifiedAt:row.metadata_verified_at,method:'SPDX comunicado por GitHub REST; texto completo y obligaciones pendientes de revisión.'}:null}))};
 }

 async function refreshNext({signal,request=fetch}={}){
  signal?.throwIfAborted();
  const instant=now(),leaseToken=randomUUID();
  const reservation=transaction(()=>{
   const backoff=getState('githubBackoff');
   if(backoff?.until>instant)return {status:'backoff',nextRun:iso(backoff.until),message:'GitHub pidió esperar; no se ha hecho ninguna solicitud.'};
   const lease=getState('githubLease');
   if(lease?.until>instant)return {status:'busy',nextRun:iso(lease.until),message:'Ya hay una consulta de metadatos en curso.'};
   const resource=db.prepare('SELECT * FROM resources WHERE github_owner IS NOT NULL AND next_check_ms<=? ORDER BY next_check_ms,COALESCE(last_checked_ms,0),resource_id LIMIT 1').get(instant);
   if(!resource)return {status:'cached',nextRun:summary().nextRun,message:'Los repositorios pendientes de consulta conservan su caché de 24 horas.'};
   setState('githubBackoff',null);setState('githubLease',{token:leaseToken,until:instant+60000,resourceId:resource.resource_id});
   return {resource};
  });
  if(!reservation.resource)return reservation;
  const resource=reservation.resource,sourceUrl=`https://api.github.com/repos/${encodeURIComponent(resource.github_owner)}/${encodeURIComponent(resource.github_repo)}`;
  let status='error',httpStatus=null,metadata=null,rawJson=null,error=null,nextCheck=instant+10*60*1000,backoffUntil=null,callerAborted=false;
  try{
   const timeout=AbortSignal.timeout(20000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
   const response=await request(sourceUrl,{method:'GET',redirect:'manual',signal:requestSignal,headers:{Accept:'application/vnd.github+json','User-Agent':'AtlasLocal-Library/1.0','X-GitHub-Api-Version':'2022-11-28'}});
   httpStatus=response.status;
   if(httpStatus===403||httpStatus===429){status='rate_limited';error='GitHub limita o rechaza temporalmente la consulta pública (HTTP '+httpStatus+').';backoffUntil=backoffFromHeaders(response.headers,now());nextCheck=backoffUntil;}
   else if(httpStatus===404){status='not_found';error='El repositorio no es accesible públicamente (HTTP 404); no se da por inexistente.';nextCheck=now()+METADATA_TTL_MS;}
   else if(httpStatus>=300&&httpStatus<400){status='redirect_pending';error='GitHub indica una redirección; queda pendiente para respetar una sola solicitud por ciclo.';nextCheck=now()+METADATA_TTL_MS;}
   else if(httpStatus!==200){throw Error('GitHub respondió HTTP '+httpStatus+'.');}
   else{
    rawJson=await metadataBody(response,requestSignal);metadata=normalizeMetadata(JSON.parse(rawJson));
    requestSignal.throwIfAborted();status='verified';nextCheck=now()+METADATA_TTL_MS;
    if(response.headers?.get?.('x-ratelimit-remaining')==='0')backoffUntil=backoffFromHeaders(response.headers,now());
   }
   if(httpStatus!==200)try{await response.body?.cancel();}catch{}
  }catch(failure){callerAborted=signal?.aborted===true;status=callerAborted?'cancelled':'error';error=callerAborted?'Consulta cancelada.':String(failure?.message||failure).slice(0,600);if(callerAborted)nextCheck=instant;}
  const completed=now(),result={status,url:resource.url,sourceUrl,httpStatus,checkedAt:iso(completed),nextRun:iso(Math.max(nextCheck,backoffUntil??0)),
   message:status==='verified'?'Metadatos públicos actualizados; la ficha conserva evidencia D y no se ha ejecutado código.':error};
  transaction(()=>{
   const lease=getState('githubLease');
   // Only the worker owning this reservation may release it.
   if(lease?.token===leaseToken)setState('githubLease',null);
   if(backoffUntil)setState('githubBackoff',{until:backoffUntil,reason:error||'Cuota pública agotada.'});
   if(metadata&&status==='verified')db.prepare('UPDATE resources SET metadata_json=?,metadata_verified_at=?,verified_license=?,license_name=?,metadata_source_url=? WHERE resource_id=?').run(JSON.stringify(metadata),iso(completed),metadata.license?.spdxId??null,metadata.license?.name??null,sourceUrl,resource.resource_id);
   db.prepare('UPDATE resources SET verification_status=?,last_checked_ms=?,next_check_ms=?,last_error=? WHERE resource_id=?').run(status,completed,nextCheck,error,resource.resource_id);
   db.prepare('INSERT INTO observations(resource_id,checked_at,source_url,method,status,http_status,raw_json,error) VALUES(?,?,?,?,?,?,?,?)').run(resource.resource_id,iso(completed),sourceUrl,'GET público GitHub REST, sin claves ni ejecución de código',status,httpStatus,rawJson,error);
   setState('lastRun',result);setState('lastError',error);
  });
  if(callerAborted)signal.throwIfAborted();
  return result;
 }

 return {importCatalog,summary,list,refreshNext,close:()=>db.close()};
}

let defaultLibrary;
const library=()=>defaultLibrary??=openRepositoryLibrary();
export const librarySummary=()=>library().summary();
export const listLibrary=options=>library().list(options);
export const refreshNextRepository=options=>library().refreshNext(options);
export function importRepositoryCatalog(text,{dbPath=DEFAULT_LIBRARY_PATH,...options}={}){
 const target=openRepositoryLibrary({dbPath});try{return target.importCatalog(text,options);}finally{target.close();}
}
