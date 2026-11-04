import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openRepositoryLibrary,DEFAULT_LIBRARY_PATH,METADATA_TTL_MS} from './repo-library.mjs';

export const DISCOVERY_PAGE_SIZE=100;
export const DISCOVERY_MAX_PAGES=10;
export const DISCOVERY_INTERVAL_MS=10000;
export const DISCOVERY_SEGMENT_START_DAY='1970-01-01';
export const DISCOVERY_SEGMENT_MAX_DEPTH=16;
export const DISCOVERY_SEGMENT_MAX_SHARDS=4095;
export const DISCOVERY_PASS_MAX_IDS=1000;
export const DISCOVERY_FOCUS_MACROAREAS=Object.freeze(['M15','M14','M12','M10','M03','M08','M19','M13','M07','M02']);
const ownerPattern=/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const repoPattern=/^[A-Za-z0-9_.-]{1,100}$/;
const iso=value=>value==null?null:new Date(value).toISOString();
const json=(value,fallback=null)=>{try{return JSON.parse(value);}catch{return fallback;}};
const DAY_MS=86400000,day=value=>new Date(value).toISOString().slice(0,10);
const dayNumber=value=>Date.parse(value+'T00:00:00.000Z')/DAY_MS;
const dayAt=value=>day(value*DAY_MS);
const shardId=(jobId,start,end)=>jobId+':created:'+start+':'+end;
function dateHalves(start,end){
 const first=dayNumber(start),last=dayNumber(end);
 if(!Number.isInteger(first)||!Number.isInteger(last)||first>=last)return null;
 const middle=Math.floor((first+last)/2);
 return [[start,dayAt(middle)],[dayAt(middle+1),end]];
}

export function loadRepositoryTaxonomy(){
 const raw=readFileSync(new URL('./repository-taxonomy.json',import.meta.url),'utf8');
 const value=JSON.parse(raw),ids=new Set(),queries=new Set(),names=new Set();
 if(value.version!==1||value.status!=='draft'||value.macroareas?.length!==25)throw Error('Se requiere la taxonomía propuesta v1 de 25 macroáreas.');
 const categories=[];
 for(const macro of value.macroareas){
  if(macro.categories?.length!==10||typeof macro.id!=='string'||typeof macro.name!=='string')throw Error('Cada macroárea necesita diez categorías.');
  for(const category of macro.categories){
   if(!/^CAT-\d{3}$/.test(category.id)||typeof category.name!=='string'||!category.name.trim()||typeof category.query!=='string'||!category.query.trim()||category.query.length>256)throw Error('Categoría de descubrimiento inválida.');
   if(ids.has(category.id)||queries.has(category.query)||names.has(category.name))throw Error('La taxonomía contiene identificadores, nombres o consultas duplicados.');
   ids.add(category.id);queries.add(category.query);names.add(category.name);
   categories.push({...category,macroareaId:macro.id,macroareaName:macro.name});
  }
 }
 for(let index=1;index<=250;index++)if(!ids.has('CAT-'+String(index).padStart(3,'0')))throw Error('Falta un identificador de categoría.');
 return {...value,categories,sha256:createHash('sha256').update(raw).digest('hex')};
}

const schema=`
CREATE TABLE IF NOT EXISTS discovery_jobs (
 job_id TEXT PRIMARY KEY, taxonomy_version INTEGER NOT NULL, category_id TEXT NOT NULL,
 category_name TEXT NOT NULL, macroarea_id TEXT NOT NULL, query TEXT NOT NULL,
 next_page INTEGER NOT NULL DEFAULT 1 CHECK(next_page BETWEEN 1 AND 10),
 last_page INTEGER NOT NULL DEFAULT 0 CHECK(last_page BETWEEN 0 AND 10),
 status TEXT NOT NULL DEFAULT 'pending', total_count INTEGER, truncated INTEGER NOT NULL DEFAULT 0,
 incomplete INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
 last_checked_ms INTEGER, next_run_ms INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 coverage_pass_id TEXT REFERENCES discovery_passes(pass_id),
 UNIQUE(taxonomy_version,category_id)
);
CREATE TABLE IF NOT EXISTS discovery_shards (
 shard_id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES discovery_jobs(job_id),
 parent_shard_id TEXT REFERENCES discovery_shards(shard_id),
 start_day TEXT NOT NULL CHECK(length(start_day)=10), end_day TEXT NOT NULL CHECK(length(end_day)=10 AND end_day>=start_day),
 depth INTEGER NOT NULL CHECK(depth BETWEEN 0 AND 16),
 next_page INTEGER NOT NULL DEFAULT 1 CHECK(next_page BETWEEN 1 AND 10), last_page INTEGER NOT NULL DEFAULT 0 CHECK(last_page BETWEEN 0 AND 10),
 status TEXT NOT NULL DEFAULT 'pending', total_count INTEGER, truncated INTEGER NOT NULL DEFAULT 0, incomplete INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0, last_checked_ms INTEGER, next_run_ms INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 saturation_reason TEXT, created_at TEXT NOT NULL,
 coverage_pass_id TEXT REFERENCES discovery_passes(pass_id),
 UNIQUE(job_id,start_day,end_day)
);
CREATE TABLE IF NOT EXISTS discovery_passes (
 pass_id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES discovery_jobs(job_id),
 shard_id TEXT REFERENCES discovery_shards(shard_id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS discovery_pass_members (
 pass_id TEXT NOT NULL REFERENCES discovery_passes(pass_id),
 github_id INTEGER NOT NULL CHECK(github_id>0), PRIMARY KEY(pass_id,github_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS discovered_repositories (
 github_id INTEGER PRIMARY KEY CHECK(github_id>0),
 resource_id INTEGER NOT NULL UNIQUE REFERENCES resources(resource_id),
 name TEXT NOT NULL, description TEXT, first_job_id TEXT NOT NULL REFERENCES discovery_jobs(job_id),
 first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
 source_url TEXT NOT NULL, metadata_json TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT 'C' CHECK(evidence='C')
);
CREATE TABLE IF NOT EXISTS discovery_hits (
 github_id INTEGER NOT NULL REFERENCES discovered_repositories(github_id), job_id TEXT NOT NULL REFERENCES discovery_jobs(job_id),
 first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, PRIMARY KEY(github_id,job_id)
);
CREATE TABLE IF NOT EXISTS discovery_observations (
 observation_id INTEGER PRIMARY KEY, job_id TEXT NOT NULL REFERENCES discovery_jobs(job_id),
 shard_id TEXT REFERENCES discovery_shards(shard_id),
 coverage_pass_id TEXT REFERENCES discovery_passes(pass_id), coverage_json TEXT,
 source_url TEXT NOT NULL, page INTEGER NOT NULL, checked_at TEXT NOT NULL, status TEXT NOT NULL,
 http_status INTEGER, total_count INTEGER, truncated INTEGER NOT NULL DEFAULT 0,
 incomplete INTEGER NOT NULL DEFAULT 0, received INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0,
 duplicate_count INTEGER NOT NULL DEFAULT 0, imported_count INTEGER NOT NULL DEFAULT 0,
 invalid_count INTEGER NOT NULL DEFAULT 0, capped_count INTEGER NOT NULL DEFAULT 0, raw_json TEXT, error TEXT
);
CREATE INDEX IF NOT EXISTS discovery_job_queue ON discovery_jobs(next_run_ms,last_checked_ms);
CREATE INDEX IF NOT EXISTS discovery_shard_queue ON discovery_shards(job_id,status,next_run_ms,last_checked_ms);
CREATE INDEX IF NOT EXISTS discovery_resource_github_id ON resources(CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json,'$.githubId') END);
`;

function metadataFor(item){
 if(!item||!Number.isSafeInteger(item.id)||item.id<1||typeof item.full_name!=='string'||item.private===true)throw Error('Identidad GitHub no pública o inválida.');
 const parts=item.full_name.split('/');
 if(parts.length!==2||!ownerPattern.test(parts[0])||!repoPattern.test(parts[1])||['.','..'].includes(parts[1]))throw Error('Nombre GitHub inválido.');
 const [owner,repo]=parts,url=`https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
 const number=value=>Number.isSafeInteger(value)&&value>=0?value:null;
 const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
 const spdx=typeof item.license?.spdx_id==='string'&&!['NOASSERTION','NONE'].includes(item.license.spdx_id)?item.license.spdx_id.slice(0,100):null;
 return {owner,repo,url,metadata:{githubId:item.id,fullName:item.full_name,description:typeof item.description==='string'?item.description.slice(0,4000):null,
  htmlUrl:url,stars:number(item.stargazers_count),forks:number(item.forks_count),language:typeof item.language==='string'?item.language.slice(0,100):null,
  topics:Array.isArray(item.topics)?item.topics.filter(t=>typeof t==='string').slice(0,50).map(t=>t.slice(0,100)):[],
  archived:typeof item.archived==='boolean'?item.archived:null,disabled:typeof item.disabled==='boolean'?item.disabled:null,
  defaultBranch:typeof item.default_branch==='string'?item.default_branch.slice(0,200):null,
  pushedAt:date(item.pushed_at),updatedAt:date(item.updated_at),license:spdx?{spdxId:spdx,name:typeof item.license.name==='string'?item.license.name.slice(0,200):null}:null}};
}

function backoff(headers,now){
 const candidates=[],retry=headers?.get?.('retry-after');
 if(retry){const seconds=Number(retry),time=Number.isFinite(seconds)?now+Math.max(0,seconds)*1000:Date.parse(retry);if(Number.isFinite(time)&&time>=now)candidates.push(time);}
 const reset=Number(headers?.get?.('x-ratelimit-reset'))*1000;
 if(Number.isFinite(reset)&&reset>now)candidates.push(reset);
 return (candidates.length?Math.max(...candidates):now+3600000)+1000;
}

async function responseText(response,signal){
 const maxBytes=4*1024*1024;
 if(response.body?.getReader){
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try{while(true){signal.throwIfAborted();const part=await reader.read();signal.throwIfAborted();if(part.done)return text+decoder.decode();size+=part.value.byteLength;if(size>maxBytes)throw Error('La respuesta de búsqueda supera 4 MiB.');text+=decoder.decode(part.value,{stream:true});}}
  finally{try{await reader.cancel();}catch{}reader.releaseLock();}
 }
 const text=typeof response.text==='function'?await response.text():JSON.stringify(await response.json());
 if(typeof text!=='string'||Buffer.byteLength(text)>maxBytes)throw Error('La respuesta de búsqueda supera 4 MiB.');
 return text;
}

export function openRepositoryDiscovery({dbPath=DEFAULT_LIBRARY_PATH,now=Date.now,repositoryLimit=100000}={}){
 if(dbPath===':memory:')throw Error('El descubrimiento necesita una ruta SQLite; las pruebas pueden usar un archivo temporal.');
 if(!Number.isSafeInteger(repositoryLimit)||repositoryLimit<1||repositoryLimit>100000)throw Error('El límite de admisión debe estar entre 1 y 100000 repositorios.');
 const base=openRepositoryLibrary({dbPath,now});base.close();
 const taxonomy=loadRepositoryTaxonomy(),categoryMap=new Map(taxonomy.categories.map(c=>[c.id,c]));
 const remainingAreas=taxonomy.macroareas.map(area=>area.id).filter(id=>!DISCOVERY_FOCUS_MACROAREAS.includes(id));
 const priority=new Map();
 for(const category of taxonomy.categories){
  const focusIndex=DISCOVERY_FOCUS_MACROAREAS.indexOf(category.macroareaId),ordinal=(Number(category.id.slice(4))-1)%10;
  priority.set(category.id,(focusIndex>=0?0:1000)+ordinal*25+(focusIndex>=0?focusIndex:remainingAreas.indexOf(category.macroareaId)));
 }
 const db=new DatabaseSync(dbPath);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 const transaction=work=>{db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 const state=(key,fallback=null)=>json(db.prepare('SELECT value FROM library_state WHERE key=?').get(key)?.value,fallback);
 const save=(key,value)=>db.prepare('INSERT INTO library_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
 try{transaction(()=>{
  db.exec(schema);
  if(!db.prepare('PRAGMA table_info(discovery_observations)').all().some(column=>column.name==='capped_count'))db.exec('ALTER TABLE discovery_observations ADD COLUMN capped_count INTEGER NOT NULL DEFAULT 0');
  if(!db.prepare('PRAGMA table_info(discovery_observations)').all().some(column=>column.name==='shard_id'))db.exec('ALTER TABLE discovery_observations ADD COLUMN shard_id TEXT REFERENCES discovery_shards(shard_id)');
  for(const table of ['discovery_jobs','discovery_shards','discovery_observations'])if(!db.prepare('PRAGMA table_info('+table+')').all().some(column=>column.name==='coverage_pass_id'))db.exec('ALTER TABLE '+table+' ADD COLUMN coverage_pass_id TEXT REFERENCES discovery_passes(pass_id)');
  if(!db.prepare('PRAGMA table_info(discovery_observations)').all().some(column=>column.name==='coverage_json'))db.exec('ALTER TABLE discovery_observations ADD COLUMN coverage_json TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS discovery_observation_shard ON discovery_observations(shard_id,observation_id)');
  const prior=state('discoveryTaxonomy');
  if(prior?.version===taxonomy.version&&prior.sha256!==taxonomy.sha256)throw Error('La taxonomía cambió sin incrementar su versión; se conserva la cola existente.');
  const insert=db.prepare('INSERT INTO discovery_jobs(job_id,taxonomy_version,category_id,category_name,macroarea_id,query) VALUES(?,?,?,?,?,?) ON CONFLICT(job_id) DO NOTHING');
  for(const category of taxonomy.categories)insert.run('v'+taxonomy.version+':'+category.id,taxonomy.version,category.id,category.name,category.macroareaId,category.query);
  save('discoveryTaxonomy',{version:taxonomy.version,sha256:taxonomy.sha256,status:'draft',categories:250,macroareas:25});
 });}catch(error){db.close();throw error;}

 function insertShard(job,start,end,instant,{parent=null,depth=0}={}){
  const id=shardId(job.job_id,start,end);
  db.prepare('INSERT INTO discovery_shards(shard_id,job_id,parent_shard_id,start_day,end_day,depth,next_run_ms,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(shard_id) DO NOTHING').run(id,job.job_id,parent,start,end,depth,instant,iso(instant));
  return id;
 }
 function segmentInfo(jobId){
  return db.prepare(`SELECT COUNT(*) AS nodes,MAX(end_day) AS end_day,
   MIN(CASE WHEN status<>'split' THEN next_run_ms END) AS next_run,
   SUM(CASE WHEN status NOT IN ('split','complete') THEN 1 ELSE 0 END) AS unresolved,
   SUM(CASE WHEN status IN ('pending','paged','error','cancelled','rate_limited') THEN 1 ELSE 0 END) AS active,
   SUM(CASE WHEN status='saturated' THEN 1 ELSE 0 END) AS saturated,
   SUM(CASE WHEN status='incomplete' THEN 1 ELSE 0 END) AS incomplete,
   SUM(CASE WHEN status='capacity_limited' THEN 1 ELSE 0 END) AS capped FROM discovery_shards WHERE job_id=?`).get(jobId);
 }
 function updateSegmentedJob(jobId,instant){
  const info=segmentInfo(jobId),tailPending=info.end_day<day(instant);
  const status=info.active?'segmenting':info.saturated||tailPending?'saturated':info.capped?'capacity_limited':info.incomplete?'incomplete':'segmented';
  const nextRun=info.next_run??instant+METADATA_TTL_MS;
  db.prepare('UPDATE discovery_jobs SET status=?,next_run_ms=? WHERE job_id=?').run(status,nextRun,jobId);
  return {status,nextRun,pending:!!info.unresolved||tailPending};
 }
 function ensureSegments(job,instant){
  let info=segmentInfo(job.job_id);
  if(!info.nodes){
   // Do not combine potentially contradictory created qualifiers. The current
   // taxonomy has none; an unsupported future query remains explicitly open.
   if(/(?:^|\s)-?created:/i.test(job.query))return false;
   insertShard(job,DISCOVERY_SEGMENT_START_DAY,day(instant),instant);info=segmentInfo(job.job_id);
  }else if(info.end_day<day(instant)&&info.nodes<DISCOVERY_SEGMENT_MAX_SHARDS){
   // New time is a separate disjoint tail; prior nodes and observations stay.
   insertShard(job,dayAt(dayNumber(info.end_day)+1),day(instant),instant);
  }
  updateSegmentedJob(job.job_id,instant);return true;
 }
 function splitShard(job,shard,instant){
  const halves=dateHalves(shard.start_day,shard.end_day);
  if(!halves)return {created:0,reason:'day-resolution'};
  if(shard.depth>=DISCOVERY_SEGMENT_MAX_DEPTH)return {created:0,reason:'max-depth'};
  if(segmentInfo(job.job_id).nodes+2>DISCOVERY_SEGMENT_MAX_SHARDS)return {created:0,reason:'shard-budget'};
  for(const [start,end] of halves)insertShard(job,start,end,instant+DISCOVERY_INTERVAL_MS,{parent:shard.shard_id,depth:shard.depth+1});
  return {created:2,reason:null};
 }

 function summary(){
  const instant=now(),blocked=state('githubBackoff'),lease=state('githubLease'),nextSearch=state('githubSearchNextAt',0);
  const next=db.prepare('SELECT MIN(next_run_ms) AS next FROM discovery_jobs WHERE taxonomy_version=?').get(taxonomy.version).next;
  const count=sql=>db.prepare(sql).get().count;
  const repositories=count('SELECT COUNT(*) AS count FROM resources WHERE github_owner IS NOT NULL');
  const jobs={};for(const row of db.prepare('SELECT status,COUNT(*) AS count FROM discovery_jobs WHERE taxonomy_version=? GROUP BY status').all(taxonomy.version))jobs[row.status]=row.count;
  const shards={};for(const row of db.prepare('SELECT s.status,COUNT(*) AS count FROM discovery_shards s JOIN discovery_jobs j USING(job_id) WHERE j.taxonomy_version=? GROUP BY s.status').all(taxonomy.version))shards[row.status]=row.count;
  const segmentationPending=db.prepare(`SELECT COUNT(*) AS count FROM discovery_jobs j WHERE j.taxonomy_version=? AND (j.truncated=1 OR j.incomplete=1 OR EXISTS(SELECT 1 FROM discovery_shards s WHERE s.job_id=j.job_id)) AND
   (NOT EXISTS(SELECT 1 FROM discovery_shards s WHERE s.job_id=j.job_id) OR EXISTS(SELECT 1 FROM discovery_shards s WHERE s.job_id=j.job_id AND s.status NOT IN ('split','complete')) OR (SELECT MAX(s.end_day) FROM discovery_shards s WHERE s.job_id=j.job_id)<?)`).get(taxonomy.version,day(instant)).count;
  return {categories:250,macroareas:25,taxonomyVersion:taxonomy.version,taxonomyStatus:'draft',validatedCategories:0,
   discovered:count('SELECT COUNT(*) AS count FROM discovered_repositories d WHERE NOT EXISTS(SELECT 1 FROM catalog_entries e WHERE e.resource_id=d.resource_id)'),
   matchedSeeds:count('SELECT COUNT(*) AS count FROM discovered_repositories d WHERE EXISTS(SELECT 1 FROM catalog_entries e WHERE e.resource_id=d.resource_id)'),
   seen:count('SELECT COUNT(*) AS count FROM discovered_repositories'),searchObservations:count('SELECT COUNT(*) AS count FROM discovery_observations'),jobs,
   targetRepositories:100000,repositoryLimit,repositories,admissionRemaining:Math.max(0,repositoryLimit-repositories),capacityReached:repositories>=repositoryLimit,elite:0,winners:0,
   nextRun:next==null?null:iso(Math.max(instant,next,blocked?.until??0,lease?.until??0,nextSearch)),
   backoffUntil:blocked?.until>instant?iso(blocked.until):null,lastRun:state('discoveryLastRun'),lastError:state('discoveryLastError'),
   state:blocked?.until>instant?'rate_limited':lease?.until>instant?'busy':Math.max(next??0,nextSearch)>instant?'waiting':'ready',
   truncatedQueries:count('SELECT COUNT(*) AS count FROM discovery_jobs WHERE truncated=1'),
   segmentationPendingQueries:segmentationPending,
   segmentation:{version:2,passCoverageTracked:true,method:'created-date-bisection',startDay:DISCOVERY_SEGMENT_START_DAY,granularity:'UTC-day',maxDepth:DISCOVERY_SEGMENT_MAX_DEPTH,maxShardsPerQuery:DISCOVERY_SEGMENT_MAX_SHARDS,shards,saturatedShards:shards.saturated||0},
   coverage:'Búsquedas preliminares con particiones persistentes y disjuntas por día de creación. Cada consulta conserva el máximo de 1.000 resultados; días saturados, respuestas incompletas y límites siguen pendientes. Agotar rangos no demuestra cobertura global, estabilidad del índice, calidad ni categorías validadas.'};
 }

 function list({query='',limit=40,offset=0}={}){
  limit=Number.isInteger(Number(limit))?Math.max(1,Math.min(200,Number(limit))):40;
  offset=Number.isInteger(Number(offset))?Math.max(0,Math.min(1000000,Number(offset))):0;
  const term=String(query).trim().slice(0,300).replace(/[\\%_]/g,'\\$&'),filter='%'+term+'%';
  const where="WHERE NOT EXISTS(SELECT 1 FROM catalog_entries e WHERE e.resource_id=d.resource_id) AND (?='' OR d.name LIKE ? ESCAPE '\\' OR d.description LIKE ? ESCAPE '\\' OR r.url LIKE ? ESCAPE '\\' OR ('GH-'||d.github_id) LIKE ? ESCAPE '\\')";
  const args=[term,filter,filter,filter,filter];
  const total=db.prepare(`SELECT COUNT(*) AS count FROM discovered_repositories d JOIN resources r USING(resource_id) ${where}`).get(...args).count;
  const rows=db.prepare(`SELECT d.*,r.url,r.github_owner,r.github_repo,r.metadata_json AS verified_metadata,r.metadata_verified_at,r.verified_license,r.metadata_source_url,r.verification_status,r.last_error,j.category_id,j.query FROM discovered_repositories d JOIN resources r USING(resource_id) JOIN discovery_jobs j ON j.job_id=d.first_job_id ${where} ORDER BY d.first_seen_at DESC,d.github_id LIMIT ? OFFSET ?`).all(...args,limit,offset);
  return {total,limit,offset,items:rows.map(row=>{
   const categories=db.prepare('SELECT j.category_id FROM discovery_hits h JOIN discovery_jobs j USING(job_id) WHERE h.github_id=? ORDER BY j.category_id').all(row.github_id).map(hit=>({id:hit.category_id,name:categoryMap.get(hit.category_id)?.name??hit.category_id}));
   return {id:'GH-'+row.github_id,githubId:row.github_id,name:row.name,url:row.url,owner:row.github_owner,repo:row.github_repo,description:row.description,evidence:'C',
    metadata:json(row.metadata_verified_at?row.verified_metadata:row.metadata_json),metadataVerifiedAt:row.metadata_verified_at,verifiedLicense:row.verified_license,
    licenseClaim:null,licenseVerification:row.verified_license?{sourceUrl:row.metadata_source_url,verifiedAt:row.metadata_verified_at,method:'SPDX comunicado por GitHub REST; obligaciones pendientes de revisión.'}:null,
    verificationStatus:row.verification_status,lastError:row.last_error,discoveredAt:row.first_seen_at,lastSeenAt:row.last_seen_at,
    category:categoryMap.get(row.category_id)?.name??row.category_id,categories,classificationMethod:'Coincidencia temática en búsqueda; categoría no validada.',
    searchSource:{url:row.source_url,at:row.last_seen_at,query:new URL(row.source_url).searchParams.get('q')||row.query,method:'GitHub REST search público; sin ejecutar código.'}};
  })};
 }

 function ingest(items,job,sourceUrl,at,instant){
  let added=0,duplicates=0,imported=0,invalid=0,capped=0;
  const coveredIds=[];
  let available=Math.max(0,repositoryLimit-db.prepare('SELECT COUNT(*) AS count FROM resources WHERE github_owner IS NOT NULL').get().count);
  for(const item of items){
   let descriptor;try{descriptor=metadataFor(item);}catch{invalid++;continue;}
   const {owner,repo,url,metadata}=descriptor;
   const existing=db.prepare('SELECT * FROM discovered_repositories WHERE github_id=?').get(item.id);
   const byUrl=db.prepare('SELECT * FROM resources WHERE url=?').get(url);
   const byMetadata=db.prepare("SELECT * FROM resources WHERE CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json,'$.githubId') END=? ORDER BY resource_id LIMIT 1").get(item.id);
   let resource=existing?db.prepare('SELECT * FROM resources WHERE resource_id=?').get(existing.resource_id):byMetadata??byUrl;
   if(resource&&byUrl&&resource.resource_id!==byUrl.resource_id){invalid++;continue;}
   if(resource){
    const known=db.prepare('SELECT github_id FROM discovered_repositories WHERE resource_id=?').get(resource.resource_id);
    const metadataId=json(resource.metadata_json)?.githubId;
    if((known&&known.github_id!==item.id)||(metadataId&&metadataId!==item.id)){invalid++;continue;}
   }
   let inserted=false;
   if(!resource){
    if(available===0){capped++;continue;}
    const result=db.prepare("INSERT INTO resources(url,github_owner,github_repo,created_at,metadata_json,metadata_source_url,next_check_ms,verification_status) VALUES(?,?,?,?,?,?,?,'discovered')").run(url,owner,repo,at,JSON.stringify(metadata),sourceUrl,instant);
    resource=db.prepare('SELECT * FROM resources WHERE resource_id=?').get(result.lastInsertRowid);inserted=true;available--;
   }else if(resource.url!==url){
    // A stable GitHub numeric ID identifies a rename; preserve all linked claims.
    db.prepare('UPDATE resources SET url=?,github_owner=?,github_repo=? WHERE resource_id=?').run(url,owner,repo,resource.resource_id);
   }
   const seed=!!db.prepare('SELECT 1 FROM catalog_entries WHERE resource_id=? LIMIT 1').get(resource.resource_id);
   if(seed)imported++;else if(inserted)added++;else duplicates++;
   db.prepare(`INSERT INTO discovered_repositories(github_id,resource_id,name,description,first_job_id,first_seen_at,last_seen_at,source_url,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(github_id) DO UPDATE SET name=excluded.name,description=excluded.description,last_seen_at=excluded.last_seen_at,source_url=excluded.source_url,metadata_json=excluded.metadata_json`).run(item.id,resource.resource_id,metadata.fullName,metadata.description,job.job_id,at,at,sourceUrl,JSON.stringify(metadata));
   db.prepare('INSERT INTO discovery_hits(github_id,job_id,first_seen_at,last_seen_at) VALUES(?,?,?,?) ON CONFLICT(github_id,job_id) DO UPDATE SET last_seen_at=excluded.last_seen_at').run(item.id,job.job_id,at,at);
   coveredIds.push(item.id);
  }
  return {added,duplicates,imported,invalid,capped,coveredIds};
 }

 function recordCoverage(passId,ids,expectedIds,invalidItems){
  let distinctIds=db.prepare('SELECT COUNT(*) AS n FROM discovery_pass_members WHERE pass_id=?').get(passId).n,overlapIds=0,untrackedIds=0;
  const exists=db.prepare('SELECT 1 FROM discovery_pass_members WHERE pass_id=? AND github_id=?'),insert=db.prepare('INSERT INTO discovery_pass_members(pass_id,github_id) VALUES(?,?)');
  for(const id of ids){
   if(exists.get(passId,id)){overlapIds++;continue;}
   if(distinctIds>=DISCOVERY_PASS_MAX_IDS){untrackedIds++;continue;}
   insert.run(passId,id);distinctIds++;
  }
  return {passId,distinctIds,expectedIds,overlapIds,invalidItems,untrackedIds,limit:DISCOVERY_PASS_MAX_IDS};
 }

 async function discover({signal,request=fetch}={}){
  signal?.throwIfAborted();const instant=now(),leaseToken=randomUUID();
  const reservation=transaction(()=>{
   const blocked=state('githubBackoff');if(blocked?.until>instant)return {status:'backoff',added:0,nextRun:iso(blocked.until),message:'GitHub pidió esperar; no se ha realizado una búsqueda.'};
   const lease=state('githubLease');if(lease?.until>instant)return {status:'busy',added:0,nextRun:iso(lease.until),message:'Otra consulta GitHub está utilizando el turno compartido.'};
   const nextSearch=state('githubSearchNextAt',0);if(nextSearch>instant)return {status:'waiting',added:0,nextRun:iso(nextSearch),message:'Se respeta el intervalo entre búsquedas.'};
   // Visit the Atlas-relevant areas first, interleaving their subcategories.
   // Already scheduled pages still retain their persisted oldest-due ordering.
   const due=db.prepare('SELECT * FROM discovery_jobs WHERE taxonomy_version=? AND next_run_ms<=?').all(taxonomy.version,instant)
    .sort((a,b)=>a.next_run_ms-b.next_run_ms||(a.last_checked_ms??0)-(b.last_checked_ms??0)||priority.get(a.category_id)-priority.get(b.category_id));
   for(const job of due){
    let shard=null;
    if(segmentInfo(job.job_id).nodes||job.truncated||job.incomplete){
     if(!ensureSegments(job,instant)){
      db.prepare("UPDATE discovery_jobs SET status='saturated',next_run_ms=?,last_error=? WHERE job_id=?").run(instant+METADATA_TTL_MS,'Partición pendiente: la consulta base ya contiene un filtro created.',job.job_id);continue;
     }
     shard=db.prepare("SELECT * FROM discovery_shards WHERE job_id=? AND status<>'split' AND next_run_ms<=? ORDER BY CASE WHEN status='complete' THEN 1 ELSE 0 END,next_run_ms,COALESCE(last_checked_ms,0),start_day,shard_id LIMIT 1").get(job.job_id,instant);
     if(!shard)continue;
     if(['complete','saturated','incomplete','capacity_limited'].includes(shard.status)){shard.next_page=1;shard.truncated=0;shard.incomplete=0;shard.coverage_pass_id=null;}
    }else if(['complete','capacity_limited'].includes(job.status)){job.next_page=1;job.truncated=0;job.incomplete=0;job.coverage_pass_id=null;}
    const target=shard||job;
    if(!target.coverage_pass_id){
     // Legacy cursors have no per-pass membership. Restart only their cursor;
     // their observations and all earlier coverage passes remain intact.
     target.next_page=1;target.coverage_pass_id=randomUUID();
     db.prepare('INSERT INTO discovery_passes(pass_id,job_id,shard_id,created_at) VALUES(?,?,?,?)').run(target.coverage_pass_id,job.job_id,shard?.shard_id??null,iso(instant));
     db.prepare('UPDATE '+(shard?'discovery_shards':'discovery_jobs')+' SET next_page=1,coverage_pass_id=? WHERE '+(shard?'shard_id':'job_id')+'=?').run(target.coverage_pass_id,shard?.shard_id??job.job_id);
    }
    save('githubBackoff',null);save('githubLease',{token:leaseToken,until:instant+60000,kind:'discovery',jobId:job.job_id,...(shard?{shardId:shard.shard_id}:{})});
    return {job,shard};
   }
   return {status:'cached',added:0,nextRun:summary().nextRun,message:'Las consultas están esperando su próxima revisión.'};
  });
  if(!reservation.job)return reservation;
  const job=reservation.job,shard=reservation.shard,target=shard||job,page=target.next_page,url=new URL('https://api.github.com/search/repositories');
  const searchQuery=job.query+(shard?' created:'+shard.start_day+'..'+shard.end_day:'');
  url.searchParams.set('q',searchQuery);url.searchParams.set('per_page',String(DISCOVERY_PAGE_SIZE));url.searchParams.set('page',String(page));url.searchParams.set('sort','updated');url.searchParams.set('order','desc');
  const sourceUrl=url.href;let status='error',httpStatus=null,error=null,rawJson=null,payload=null,blockedUntil=null,callerAborted=false;
  try{
   const timeout=AbortSignal.timeout(20000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
   const response=await request(sourceUrl,{method:'GET',redirect:'manual',signal:requestSignal,headers:{Accept:'application/vnd.github+json','User-Agent':'AtlasLocal-Library/1.0','X-GitHub-Api-Version':'2022-11-28'}});
   httpStatus=response.status;
   if(requestSignal.aborted)try{void response.body?.cancel().catch(()=>{});}catch{}
   requestSignal.throwIfAborted();
   if(httpStatus===403||httpStatus===429){status='rate_limited';error='GitHub limita o rechaza temporalmente la búsqueda (HTTP '+httpStatus+').';blockedUntil=backoff(response.headers,now());}
   else if(httpStatus!==200){error='GitHub respondió HTTP '+httpStatus+'; el cursor se conserva.';}
   else{
    rawJson=await responseText(response,requestSignal);const raw=JSON.parse(rawJson);
    if(!raw||!Number.isSafeInteger(raw.total_count)||raw.total_count<0||typeof raw.incomplete_results!=='boolean'||!Array.isArray(raw.items)||raw.items.length>100)throw Error('La respuesta de búsqueda no respeta el formato o tamaño esperado.');
    payload=raw;requestSignal.throwIfAborted();status='searched';
    if(response.headers?.get?.('x-ratelimit-remaining')==='0')blockedUntil=backoff(response.headers,now());
   }
   if(httpStatus!==200)try{await response.body?.cancel();}catch{}
  }catch(failure){callerAborted=signal?.aborted===true;status=callerAborted?'cancelled':'error';error=callerAborted?'Búsqueda cancelada; cursor conservado.':String(failure?.message||failure).slice(0,600);}
  const completed=now(),at=iso(completed);
  // A caller may cancel while an HTTP-error body is being released, too.
  // Commit a cancellation receipt, not its response's quota or retry delay.
  if(signal?.aborted){callerAborted=true;status='cancelled';error='Búsqueda cancelada; cursor conservado.';payload=null;blockedUntil=null;}
  const result=transaction(()=>{
   const lease=state('githubLease');
   if(lease?.token!==leaseToken)return {status:'superseded',added:0,message:'El turno caducó; no se aplican resultados de una reserva anterior.'};
   save('githubLease',null);
   if(blockedUntil)save('githubBackoff',{until:blockedUntil,reason:error||'Cuota de búsqueda agotada.'});
   save('githubSearchNextAt',callerAborted?instant:completed+DISCOVERY_INTERVAL_MS);
   let counts={added:0,duplicates:0,imported:0,invalid:0,capped:0},nextPage=page,nextRun=callerAborted?instant:blockedUntil??completed+10*60000;
   let truncated=target.truncated,incomplete=target.incomplete,totalCount=target.total_count,targetStatus=status,saturationReason=null,splitCreated=0,coverage=null;
   if(payload&&status==='searched'){
    const {coveredIds,...ingested}=ingest(payload.items,job,sourceUrl,at,completed);counts=ingested;totalCount=payload.total_count;
    coverage=recordCoverage(target.coverage_pass_id,coveredIds,Math.min(totalCount,page*DISCOVERY_PAGE_SIZE,DISCOVERY_PASS_MAX_IDS),counts.invalid);
    truncated=Number(!!target.truncated||totalCount>1000);
    const shortfall=payload.items.length<Math.min(DISCOVERY_PAGE_SIZE,Math.max(0,Math.min(totalCount,1000)-(page-1)*DISCOVERY_PAGE_SIZE));
    incomplete=Number(!!target.incomplete||payload.incomplete_results===true||shortfall||coverage.overlapIds||coverage.invalidItems||coverage.untrackedIds||coverage.distinctIds<coverage.expectedIds);
    const finished=page>=DISCOVERY_MAX_PAGES||payload.items.length<DISCOVERY_PAGE_SIZE||page*DISCOVERY_PAGE_SIZE>=Math.min(totalCount,1000);
    targetStatus=finished?(truncated?'saturated':incomplete?'incomplete':'complete'):'paged';
    nextPage=finished?page:page+1;nextRun=finished?completed+METADATA_TTL_MS:completed+DISCOVERY_INTERVAL_MS;
    if(counts.capped){targetStatus='capacity_limited';saturationReason='capacity';nextPage=page;nextRun=completed+METADATA_TTL_MS;}
    else if(shard&&(truncated||incomplete)){
     const split=splitShard(job,shard,completed);splitCreated=split.created;saturationReason=split.reason;
     if(split.created){targetStatus='split';nextPage=page;nextRun=completed+DISCOVERY_INTERVAL_MS;}
    }else if(!shard&&(truncated||incomplete))targetStatus='segmenting';
   }
   let jobStatus=targetStatus,segmentationPending=!!truncated||!!incomplete;
   if(shard){
    db.prepare('UPDATE discovery_shards SET next_page=?,last_page=?,status=?,total_count=?,truncated=?,incomplete=?,attempts=attempts+1,last_checked_ms=?,next_run_ms=?,last_error=?,saturation_reason=? WHERE shard_id=?').run(nextPage,payload&&status==='searched'?page:shard.last_page,targetStatus,totalCount,truncated,incomplete,completed,nextRun,error,saturationReason,shard.shard_id);
    db.prepare('UPDATE discovery_jobs SET attempts=attempts+1,last_checked_ms=?,truncated=MAX(truncated,?),incomplete=MAX(incomplete,?),last_error=? WHERE job_id=?').run(completed,truncated,incomplete,error,job.job_id);
    const parent=updateSegmentedJob(job.job_id,completed);jobStatus=parent.status;nextRun=parent.nextRun;segmentationPending=parent.pending;
   }else{
    db.prepare('UPDATE discovery_jobs SET next_page=?,last_page=?,status=?,total_count=?,truncated=?,incomplete=?,attempts=attempts+1,last_checked_ms=?,next_run_ms=?,last_error=? WHERE job_id=?').run(nextPage,payload&&status==='searched'?page:job.last_page,targetStatus,totalCount,truncated,incomplete,completed,nextRun,error,job.job_id);
    if(targetStatus==='segmenting'){
     if(ensureSegments({...job,truncated,incomplete},completed)){const parent=updateSegmentedJob(job.job_id,completed);jobStatus=parent.status;nextRun=parent.nextRun;segmentationPending=parent.pending;}
     else{jobStatus='saturated';nextRun=completed+METADATA_TTL_MS;db.prepare('UPDATE discovery_jobs SET status=?,next_run_ms=? WHERE job_id=?').run(jobStatus,nextRun,job.job_id);}
    }
   }
   db.prepare('INSERT INTO discovery_observations(job_id,shard_id,coverage_pass_id,coverage_json,source_url,page,checked_at,status,http_status,total_count,truncated,incomplete,received,added,duplicate_count,imported_count,invalid_count,capped_count,raw_json,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(job.job_id,shard?.shard_id??null,target.coverage_pass_id,coverage?JSON.stringify(coverage):null,sourceUrl,page,at,status,httpStatus,totalCount,truncated,incomplete,payload?.items.length??0,counts.added,counts.duplicates,counts.imported,counts.invalid,counts.capped,rawJson,error);
   const outcome={status,...counts,categoryId:job.category_id,category:job.category_name,query:searchQuery,page,nextPage:targetStatus==='paged'?nextPage:null,
    totalCount,truncated:!!truncated,segmentationPending,incomplete:!!incomplete,received:payload?.items.length??0,sourceUrl,checkedAt:at,jobStatus,nextRun:iso(Math.max(nextRun,blockedUntil??0)),
    shardId:shard?.shard_id??null,shardStatus:shard?targetStatus:null,range:shard?{startDay:shard.start_day,endDay:shard.end_day,depth:shard.depth}:null,splitCreated,saturationReason,coverage,
    message:status==='searched'?`${counts.added} repositorios nuevos; resultados preliminares de búsqueda, sin evaluación ni ejecución.${counts.capped?' '+counts.capped+' resultados no admitidos por alcanzar el límite de repositorios.':''}`:error};
   save('discoveryLastRun',outcome);save('discoveryLastError',error);return outcome;
  });
  if(callerAborted)signal.throwIfAborted();
  return result;
 }

 return {summary,list,discover,close:()=>db.close()};
}

let defaultDiscovery;
const discovery=()=>defaultDiscovery??=openRepositoryDiscovery();
export const discoverySummary=()=>discovery().summary();
export const listDiscovered=options=>discovery().list(options);
export const discoverNextRepositories=options=>discovery().discover(options);
