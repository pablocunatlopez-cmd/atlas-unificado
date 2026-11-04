import {DatabaseSync} from 'node:sqlite';

export const REPOSITORY_CSV_MAX_ROWS=100000;
export const REPOSITORY_CSV_CHUNK_BYTES=65536;
export const REPOSITORY_CSV_COLUMNS=Object.freeze([
 'resource_id','repository','url','description','language','topics','stars','forks','archived','disabled','default_branch','pushed_at','updated_at',
 'resource_created_at','catalog_id','catalog_imported_at','license_claim','license_claim_status','license_spdx_metadata','license_name_metadata',
 'license_metadata_basis','license_full_text_verified','metadata_source_url','metadata_observed_at','metadata_verified_at','last_checked_at','verification_status',
]);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const failure=code=>Object.assign(new Error('Exportación CSV: '+code+'.'),{code});
const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const date=value=>typeof value==='string'&&value.length<=64&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
const number=value=>Number.isSafeInteger(value)&&value>=0?String(value):'';
const boolean=value=>typeof value==='boolean'?String(value):'';
const statuses=new Set(['pending','reference','verified','discovered','error','rate_limited','not_found','redirect_pending','cancelled']);
const reservedOwners=new Set(['topics','orgs','organizations','search','settings','login','marketplace','collections','features','sponsors','about','pricing','site']);
function identity(row){
 const owner=row.github_owner,repo=row.github_repo;
 if(typeof owner!=='string'||typeof repo!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner)||!/^[A-Za-z0-9_.-]{1,100}$/.test(repo)||['.','..'].includes(repo)||reservedOwners.has(owner.toLowerCase()))return null;
 const repository=(owner+'/'+repo).toLowerCase(),url='https://github.com/'+repository;
 if(typeof row.url!=='string'||row.url.toLowerCase()!==url)return null;
 return {repository,url};
}
function source(value,repository){
 if(typeof value!=='string'||value.length>512)return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='api.github.com'||url.username||url.password||url.port)return null;
  const pathname=url.pathname.replace(/\/$/,'');
  if(pathname.toLowerCase()==='/repos/'+repository)return {url:'https://api.github.com'+pathname,kind:'github-rest-spdx-metadata'};
  if(pathname==='/search/repositories')return {url:'https://api.github.com/search/repositories',kind:'github-search-spdx-metadata'};
 }catch{}
 return null;
}
function spdx(value){
 return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9.+-]{0,80}$/.test(value)&&!['NOASSERTION','NONE','UNKNOWN','OTHER'].includes(value.toUpperCase())&&!/^LicenseRef-/i.test(value)?value:'';
}
function metadata(value){
 if(typeof value!=='string')return {};
 try{const parsed=JSON.parse(value);return record(parsed)?parsed:{};}catch{return {};}
}
function csvCell(value){
 let result=value==null?'':String(value);
 // Quote CSV syntax and also stop formula evaluation after control/space
 // prefixes. Quoting alone does not prevent spreadsheet formula injection.
 if(/^[\s\u0000-\u001F\u007F-\u009F\u200B\u2060]*[=+@-]/u.test(result)||/^[\u0000-\u001F\u007F-\u009F\uFEFF]/u.test(result))result="'"+result;
 return '"'+result.replace(/"/g,'""')+'"';
}
const csvRow=values=>values.map(csvCell).join(',')+'\r\n';
function publicRow(row,claim){
 const id=identity(row);if(!id)return null;
 const info=metadata(row.metadata_json);
 if(info.private===true||info.visibility==='private')return null;
 const sameIdentity=typeof info.fullName!=='string'||info.fullName.toLowerCase()===id.repository;
 const data=sameIdentity?info:{},origin=source(row.metadata_source_url,id.repository),verifiedAt=date(row.metadata_verified_at),createdAt=date(row.created_at);
 const licenseId=origin&&sameIdentity?(verifiedAt?spdx(row.verified_license)||spdx(data.license?.spdxId):spdx(data.license?.spdxId)):'';
 const licenseName=licenseId?text(verifiedAt?row.license_name||data.license?.name:data.license?.name,200):'';
 const catalogId=typeof claim?.id==='string'&&/^AT-\d{3}$/.test(claim.id)?claim.id:'',licenseClaim=catalogId?text(claim.license_claim,1000):'';
 const lastChecked=Number.isSafeInteger(row.last_checked_ms)&&row.last_checked_ms>=0&&row.last_checked_ms<=8640000000000000?new Date(row.last_checked_ms).toISOString():'';
 return [number(row.resource_id),id.repository,id.url,text(data.description,4000),text(data.language,100),
  Array.isArray(data.topics)?data.topics.slice(0,50).filter(value=>typeof value==='string').map(value=>value.slice(0,100)).join(' | '):'',
  number(data.stars),number(data.forks),boolean(data.archived),boolean(data.disabled),text(data.defaultBranch,200),date(data.pushedAt),date(data.updatedAt),createdAt,
  catalogId,catalogId?date(claim.created_at):'',licenseClaim,licenseClaim?'imported_unverified':'',licenseId,licenseName,licenseId?origin.kind:'','false',
  origin?.url||'',origin?(verifiedAt||createdAt):'',verifiedAt,lastChecked,statuses.has(row.verification_status)?row.verification_status:'unknown'];
}

/** Stream public repository metadata from a dedicated read-only SQLite snapshot.
 * This does not open the library's writable initialization path or read source
 * text, source paths, raw claims, observations, errors, histories or credentials.
 * One deterministic catalogue entry supplies a separately marked license claim.
 * Search provenance omits query strings; GitHub SPDX metadata is not a full
 * license-text review. Strings are UTF-8 CSV with CRLF records, <=64 KiB/chunk.
 * Consumers must return/abort the iterator when ending an HTTP response early.
 */
export async function* streamRepositoryCsv(options={}){
 if(!record(options)||Object.keys(options).some(key=>!['dbPath','signal','maxRows','timeoutMs'].includes(key)))throw new TypeError('Opciones de exportación no válidas.');
 const {dbPath,signal,maxRows=REPOSITORY_CSV_MAX_ROWS,timeoutMs=30000}=options;
 if(typeof dbPath!=='string'||!dbPath||dbPath===':memory:'||dbPath.includes('\0')||!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>REPOSITORY_CSV_MAX_ROWS||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||signal!==undefined&&!(signal instanceof AbortSignal))throw new TypeError('Límites o archivo de exportación no válidos.');
 signal?.throwIfAborted();
 const deadline=Date.now()+timeoutMs;
 let db=null,iterator=null,inTransaction=false,timedOut=false,disposed=false;
 const dispose=()=>{
  if(disposed)return;disposed=true;
  try{iterator?.return?.();}catch{}iterator=null;
  if(db){try{if(inTransaction)db.exec('ROLLBACK');}catch{}inTransaction=false;try{db.close();}catch{}db=null;}
 };
 const check=()=>{signal?.throwIfAborted();if(timedOut||Date.now()>=deadline)throw failure('export_timeout');};
 const abort=()=>dispose();
 const timer=setTimeout(()=>{timedOut=true;dispose();},timeoutMs);
 timer.unref?.();signal?.addEventListener('abort',abort,{once:true});
 try{
  check();
  db=new DatabaseSync(dbPath,{readOnly:true});
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout='+Math.min(timeoutMs,1000)+'; BEGIN;');inTransaction=true;
  // Establish the snapshot before yielding headers, even for an empty library.
  db.prepare('SELECT resource_id FROM resources LIMIT 1').get();
  const hasCatalog=!!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='catalog_entries'").get();
  const claim=hasCatalog?db.prepare('SELECT id,substr(license_claim,1,1000) AS license_claim,substr(created_at,1,64) AS created_at FROM catalog_entries WHERE resource_id=? ORDER BY id LIMIT 1'):null;
  const query=db.prepare(`SELECT resource_id,substr(url,1,300) AS url,substr(github_owner,1,100) AS github_owner,substr(github_repo,1,150) AS github_repo,
   substr(created_at,1,64) AS created_at,CASE WHEN length(CAST(metadata_json AS BLOB))<=65536 THEN metadata_json ELSE NULL END AS metadata_json,
   substr(metadata_verified_at,1,64) AS metadata_verified_at,substr(verified_license,1,100) AS verified_license,substr(license_name,1,200) AS license_name,
   substr(metadata_source_url,1,513) AS metadata_source_url,last_checked_ms,substr(verification_status,1,40) AS verification_status
   FROM resources WHERE github_owner IS NOT NULL AND github_repo IS NOT NULL ORDER BY resource_id LIMIT ?`);
  iterator=query.iterate(maxRows);check();
  yield csvRow(REPOSITORY_CSV_COLUMNS);check();
  let chunk='',chunkBytes=0;
  for(;;){
   check();const next=iterator.next();if(next.done)break;
   const values=publicRow(next.value,claim?.get(next.value.resource_id));if(!values)continue;
   const line=csvRow(values),lineBytes=Buffer.byteLength(line);
   if(lineBytes>REPOSITORY_CSV_CHUNK_BYTES)throw failure('row_budget_exceeded');
   if(chunkBytes+lineBytes>REPOSITORY_CSV_CHUNK_BYTES){yield chunk;check();chunk='';chunkBytes=0;}
   chunk+=line;chunkBytes+=lineBytes;
  }
  if(chunk){check();yield chunk;check();}
 }catch(error){
  if(signal?.aborted)signal.throwIfAborted();
  if(timedOut||Date.now()>=deadline)throw failure('export_timeout');
  if(['export_timeout','row_budget_exceeded'].includes(error?.code))throw error;
  throw failure('database_unavailable');
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);dispose();}
}
