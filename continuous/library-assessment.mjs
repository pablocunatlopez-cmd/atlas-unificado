import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ASSESSMENT_WEIGHTS=Object.freeze({reuse:30,aiIntegration:20,technicalSecurity:15,productPotential:15,utility:10,maintenance:10});
export const ASSESSMENT_TARGETS=Object.freeze({repositories:100000,elite:1000,winners:250,categories:250});
export const DEFAULT_ASSESSMENT_PATH=fileURLToPath(new URL('./data/repository-assessments.sqlite',import.meta.url));
const FORMAT_VERSION=1,ZERO_HASH='0'.repeat(64),levels=['D','C','B','A'];
const kinds=['metadata','public-review','code','license','documentation','security','test','comparison','cost','hardware'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const failure=message=>{throw new Error('Evaluación: '+message);};

function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)failure(label+' debe ser un objeto JSON.');return value;}
function keys(value,allowed,label){object(value,label);for(const key of Object.keys(value))if(!allowed.includes(key))failure(label+': campo desconocido '+key+'.');return value;}
function text(value,label,{max=4000,empty=false}={}){if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))failure(label+' no es un texto válido.');return value.trim();}
function choice(value,allowed,label){if(!allowed.includes(value))failure(label+' no es válido.');return value;}
function decimal(value,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||Math.abs(value*100-Math.round(value*100))>1e-7)failure(label+' debe ser un número entre 0 y '+max+' con hasta dos decimales.');return value;}
function timestamp(value,label){text(value,label,{max:32});if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))failure(label+' requiere una fecha UTC ISO 8601.');const normalized=new Date(value).toISOString();if(normalized.slice(0,19)!==value.slice(0,19))failure(label+' no es una fecha válida.');return normalized;}
function revision(value,label){if(value==null)return null;if(typeof value!=='string'||! /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value))failure(label+' requiere un hash de commit completo.');return value.toLowerCase();}
function digest(value,label){if(value==null)return null;if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))failure(label+' requiere SHA256.');return value.toLowerCase();}
function boolean(value,label){if(typeof value!=='boolean')failure(label+' debe ser booleano.');return value;}
function stringList(value,label,{max=40,width=2000}={}){if(!Array.isArray(value)||value.length>max)failure(label+' debe ser una lista acotada.');return Array.from(value,(item,index)=>text(item,label+'['+index+']',{max:width}));}
function sourceUrl(value,label){text(value,label,{max:2000});let url;try{url=new URL(value);}catch{failure(label+' requiere una URL.');}if(!['https:','file:'].includes(url.protocol)||url.username||url.password||url.port||url.hash||(url.protocol==='https:'&&!url.hostname)||(url.protocol==='file:'&&(url.host||!/^\/(?:[A-Za-z]:\/|[^/])/.test(url.pathname))))failure(label+' admite HTTPS o un archivo local absoluto, sin credenciales, puerto ni fragmento.');return url.href;}
function githubUrl(value,label){const href=sourceUrl(value,label),url=new URL(href),parts=url.pathname.split('/').filter(Boolean),repo=parts[1]?.replace(/\.git$/i,'');if(url.protocol!=='https:'||url.hostname!=='github.com'||url.search||parts.length!==2||!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(parts[0])||!repo||!/^[A-Za-z0-9_.-]{1,100}$/.test(repo)||['.','..'].includes(repo)||['topics','orgs','search','settings','login','collections'].includes(parts[0].toLowerCase()))failure(label+' requiere una identidad GitHub pública owner/repository.');return 'https://github.com/'+parts[0].toLowerCase()+'/'+repo.toLowerCase();}
function category(value){if(typeof value!=='string'||!/^CAT-\d{3}$/.test(value)||Number(value.slice(4))<1||Number(value.slice(4))>250)failure('categoryId debe ser CAT-001…CAT-250.');return value;}
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';}
function freeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
function references(value,label,evidenceIds){const ids=stringList(value,label,{max:32,width:80});if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!evidenceIds.has(id)))failure(label+' debe referenciar pruebas existentes, sin duplicados.');return ids;}

/**
 * Pure, fail-closed assessment. Scores are supplied points, never inferred from stars.
 * Every supplied score requires scoreRationales[key]={reason,evidenceIds}.
 * Proofs record reported outcomes and provenance; this function does NOT execute
 * tests, fetch URLs, establish copyright rights, or independently verify claims.
 * Eligibility permits later review; it NEVER selects an elite item or a winner.
 */
export function evaluateRepositoryAssessment(input,{now=Date.now}={}){
 keys(input,['repository','categoryId','scores','scoreRationales','dimensions','legal','security','evidenceLevel','evidence'],'assessment');
 const time=typeof now==='function'?now():now;if(!Number.isFinite(time))failure('el reloj no es válido.');const evaluatedAt=new Date(time).toISOString();
 const repo=keys(input.repository,['githubId','url','revision'],'repository');
 if(!Number.isSafeInteger(repo.githubId)||repo.githubId<1)failure('repository.githubId debe ser un identificador positivo.');
 const repository={githubId:repo.githubId,url:githubUrl(repo.url,'repository.url'),revision:revision(repo.revision,'repository.revision')};
 const categoryId=category(input.categoryId),requestedEvidenceLevel=choice(input.evidenceLevel??'D',levels,'evidenceLevel');
 const evidenceInput=input.evidence??[];if(!Array.isArray(evidenceInput)||evidenceInput.length>128)failure('evidence debe ser una lista de hasta 128 elementos.');
 const evidenceIds=new Set();
 const evidence=Array.from(evidenceInput,(raw,index)=>{
  const label='evidence['+index+']';keys(raw,['id','kind','sourceUrl','observedAt','method','outcome','sha256','revision','reproduction','alternatives','summary'],label);
  const id=text(raw.id,label+'.id',{max:80});if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(id)||evidenceIds.has(id))failure(label+'.id debe ser único y seguro.');evidenceIds.add(id);
  const kind=choice(raw.kind,kinds,label+'.kind'),observedAt=timestamp(raw.observedAt,label+'.observedAt');if(Date.parse(observedAt)>time)failure(label+' está fechado en el futuro.');
  let reproduction=null;if(raw.reproduction!=null){if(kind!=='test')failure(label+': solo test admite reproduction.');keys(raw.reproduction,['command','environment'],label+'.reproduction');reproduction={command:text(raw.reproduction.command,label+'.command',{max:2000}),environment:text(raw.reproduction.environment,label+'.environment',{max:2000})};}
  const alternatives=raw.alternatives==null?[]:stringList(raw.alternatives,label+'.alternatives',{max:20,width:2000}).map(url=>githubUrl(url,label+'.alternative'));
  if(raw.alternatives!=null&&kind!=='comparison')failure(label+': solo comparison admite alternatives.');
  if(new Set(alternatives).size!==alternatives.length||alternatives.includes(repository.url))failure(label+': alternativas repetidas o iguales al repositorio evaluado.');
  return {id,kind,sourceUrl:sourceUrl(raw.sourceUrl,label+'.sourceUrl'),observedAt,method:text(raw.method,label+'.method',{max:2000}),outcome:choice(raw.outcome,['pass','fail','pending'],label+'.outcome'),sha256:digest(raw.sha256,label+'.sha256'),revision:revision(raw.revision,label+'.revision'),reproduction,alternatives,summary:raw.summary==null?'':text(raw.summary,label+'.summary',{max:4000,empty:true})};
 });
 const rawScores=keys(input.scores??{},Object.keys(ASSESSMENT_WEIGHTS),'scores'),rationales=keys(input.scoreRationales??{},Object.keys(ASSESSMENT_WEIGHTS),'scoreRationales');
 const components={};for(const [key,maximum] of Object.entries(ASSESSMENT_WEIGHTS)){
  const points=rawScores[key]??null;let rationale=null;
  if(points!=null){decimal(points,maximum,'scores.'+key);keys(rationales[key],['reason','evidenceIds'],'scoreRationales.'+key);rationale={reason:text(rationales[key].reason,key+'.reason'),evidenceIds:references(rationales[key].evidenceIds,key+'.evidenceIds',evidenceIds)};}
  else if(own(rationales,key))failure('No se admite justificación sin puntuación en '+key+'.');
  components[key]={points,maximum,rationale};
 }
 const complete=Object.values(components).every(value=>value.points!==null),total=complete?Math.round(Object.values(components).reduce((sum,value)=>sum+Math.round(value.points*100),0))/100:null;
 const rawDimensions=keys(input.dimensions??{},['technicalExcellence','strategicValue','totalCost'],'dimensions'),dimensions={technicalExcellence:null,strategicValue:null,totalCost:null};
 for(const key of ['technicalExcellence','strategicValue'])if(rawDimensions[key]!=null){const value=keys(rawDimensions[key],['score','reason','evidenceIds'],'dimensions.'+key);dimensions[key]={score:decimal(value.score,100,key+'.score'),reason:text(value.reason,key+'.reason'),evidenceIds:references(value.evidenceIds,key+'.evidenceIds',evidenceIds)};}
 if(rawDimensions.totalCost!=null){const value=keys(rawDimensions.totalCost,['amount','currency','period','basis','evidenceIds'],'dimensions.totalCost');if(typeof value.currency!=='string'||!/^[A-Z]{3}$/.test(value.currency))failure('totalCost.currency requiere un código de tres letras.');dimensions.totalCost={amount:decimal(value.amount,Number.MAX_SAFE_INTEGER/100,'totalCost.amount'),currency:value.currency,period:choice(value.period,['one-time','month','year','usage'],'totalCost.period'),basis:text(value.basis,'totalCost.basis'),evidenceIds:references(value.evidenceIds,'totalCost.evidenceIds',evidenceIds)};}
 const rawLegal=keys(input.legal??{},['status','licenseSpdx','obligations','rightsReviewed','obligationsReviewed','patentReview'],'legal');
 const legal={status:choice(rawLegal.status??'pending',['pending','compatible','restricted','incompatible','excluded'],'legal.status'),licenseSpdx:rawLegal.licenseSpdx==null?null:text(rawLegal.licenseSpdx,'legal.licenseSpdx',{max:200}),obligations:stringList(rawLegal.obligations??[],'legal.obligations'),rightsReviewed:boolean(rawLegal.rightsReviewed??false,'legal.rightsReviewed'),obligationsReviewed:boolean(rawLegal.obligationsReviewed??false,'legal.obligationsReviewed'),patentReview:choice(rawLegal.patentReview??'pending',['pending','reviewed','not-applicable'],'legal.patentReview')};
 const rawSecurity=keys(input.security??{},['status','criticalFindings','notes'],'security');
 const criticalFindings=rawSecurity.criticalFindings??null;if(criticalFindings!==null&&(!Number.isSafeInteger(criticalFindings)||criticalFindings<0))failure('security.criticalFindings debe ser un entero no negativo o null.');
 const security={status:choice(rawSecurity.status??'pending',['pending','reviewed','blocked'],'security.status'),criticalFindings,notes:stringList(rawSecurity.notes??[],'security.notes')};
 const pinned=proof=>repository.revision!==null&&proof.outcome==='pass'&&proof.sha256!==null&&proof.revision===repository.revision;
 const proofFor=kind=>evidence.filter(proof=>proof.kind===kind&&pinned(proof));
 const codeReviewed=proofFor('code').length>0,licenseReviewed=proofFor('license').length>0,documentationReviewed=proofFor('documentation').length>0;
 const testReproduced=proofFor('test').some(proof=>proof.reproduction!==null),comparisonReviewed=proofFor('comparison').some(proof=>proof.alternatives.length>0&&proof.summary.length>0);
 const supportedEvidenceLevel=codeReviewed&&licenseReviewed&&documentationReviewed?(testReproduced?'A':'B'):evidence.some(proof=>proof.outcome==='pass')?'C':'D';
 const evidenceLevel=levels[Math.min(levels.indexOf(requestedEvidenceLevel),levels.indexOf(supportedEvidenceLevel))];
 const exclusions=[];if(['incompatible','excluded'].includes(legal.status))exclusions.push('legal-exclusion');if(security.status==='blocked'||criticalFindings>0)exclusions.push('security-exclusion');
 for(const kind of ['test','license','security','code','documentation'])if(evidence.some(proof=>proof.kind===kind&&proof.outcome==='fail'&&proof.revision===repository.revision))exclusions.push('failed-'+kind);
 const eliteBlockers=[...exclusions];if(!complete)eliteBlockers.push('scores-incomplete');if(!['A','B'].includes(evidenceLevel))eliteBlockers.push('evidence-b-required');if(!repository.revision)eliteBlockers.push('revision-required');
 if(!codeReviewed)eliteBlockers.push('code-review-required');if(!documentationReviewed)eliteBlockers.push('documentation-review-required');
 if(!licenseReviewed||legal.status!=='compatible'||!legal.licenseSpdx||!legal.rightsReviewed||!legal.obligationsReviewed||legal.patentReview==='pending')eliteBlockers.push('legal-review-required');
 if(!proofFor('security').length||security.status!=='reviewed'||criticalFindings!==0)eliteBlockers.push('security-review-required');
 const winnerBlockers=[...eliteBlockers];if(evidenceLevel!=='A')winnerBlockers.push('evidence-a-required');if(!testReproduced)winnerBlockers.push('reproducible-test-required');if(!comparisonReviewed)winnerBlockers.push('comparison-required');
 if(!dimensions.technicalExcellence||!dimensions.strategicValue)winnerBlockers.push('separate-dimensions-required');
 if(!dimensions.totalCost||!dimensions.totalCost.evidenceIds.some(id=>proofFor('cost').some(proof=>proof.id===id)))winnerBlockers.push('cost-review-required');
 const assessment={version:FORMAT_VERSION,evaluatedAt,repository,categoryId,targets:{...ASSESSMENT_TARGETS},score:{weights:{...ASSESSMENT_WEIGHTS},components,complete,total},dimensions,legal,security,evidence:{requestedLevel:requestedEvidenceLevel,supportedLevel:supportedEvidenceLevel,level:evidenceLevel,validation:'structure-and-consistency-only',records:evidence},eligibility:{elite:eliteBlockers.length===0,winner:winnerBlockers.length===0,eliteBlockers,winnerBlockers},status:exclusions.length?'excluded':winnerBlockers.length?'pending':'eligible-for-review',selection:{elite:false,winner:false,status:'not-selected'}};
 if(Buffer.byteLength(JSON.stringify(assessment))>128000)failure('el expediente normalizado supera 128.000 bytes.');
 return freeze(assessment);
}

const triggerDefinitions={
 assessment_no_update:"CREATE TRIGGER IF NOT EXISTS assessment_no_update BEFORE UPDATE ON assessment_records BEGIN SELECT RAISE(ABORT,'assessment ledger is append-only'); END;",
 assessment_no_delete:"CREATE TRIGGER IF NOT EXISTS assessment_no_delete BEFORE DELETE ON assessment_records BEGIN SELECT RAISE(ABORT,'assessment ledger is append-only'); END;",
 assessment_meta_no_update:"CREATE TRIGGER IF NOT EXISTS assessment_meta_no_update BEFORE UPDATE ON assessment_meta BEGIN SELECT RAISE(ABORT,'assessment metadata is immutable'); END;",
 assessment_meta_no_delete:"CREATE TRIGGER IF NOT EXISTS assessment_meta_no_delete BEFORE DELETE ON assessment_meta BEGIN SELECT RAISE(ABORT,'assessment metadata is immutable'); END;"
};
const normalizedSql=value=>String(value??'').replace(/\bIF\s+NOT\s+EXISTS\s+/ig,'').replace(/\s+/g,' ').trim().replace(/;$/,'');
const schema=`
CREATE TABLE IF NOT EXISTS assessment_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assessment_records (
 sequence INTEGER PRIMARY KEY CHECK(sequence>0), assessment_id TEXT NOT NULL UNIQUE,
 repository_id INTEGER NOT NULL CHECK(repository_id>0), category_id TEXT NOT NULL,
 created_at TEXT NOT NULL, previous_hash TEXT NOT NULL CHECK(length(previous_hash)=64),
 record_hash TEXT NOT NULL UNIQUE CHECK(length(record_hash)=64), payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE INDEX IF NOT EXISTS assessment_repository ON assessment_records(repository_id,sequence);
CREATE INDEX IF NOT EXISTS assessment_category ON assessment_records(category_id,sequence);
${Object.values(triggerDefinitions).join('\n')}
PRAGMA user_version=1;
`;
const recordHash=(sequence,previousHash,payload)=>hash('atlas-repository-assessment:v1\n'+canonical({sequence,previousHash,payload}));

/** A separate, explicitly opened append-only SQLite ledger. No service or catalog import. */
export function openAssessmentLedger({dbPath,now=Date.now}={}){
 if(typeof dbPath!=='string'||!dbPath.trim())throw Error('El ledger requiere dbPath explícito; no abre la biblioteca canónica.');
 if(basename(dbPath).toLowerCase()==='repo-library.sqlite')throw Error('Usa un archivo de evaluaciones separado de repo-library.sqlite.');
 if(dbPath!==':memory:'&&existsSync(dbPath)){
  const probe=new DatabaseSync(dbPath,{readOnly:true});try{
   const tables=probe.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>row.name);
   if(tables.some(name=>!['assessment_meta','assessment_records'].includes(name)))throw Error('El archivo pertenece a otra base; no se modifica.');
   if(probe.prepare('PRAGMA user_version').get().user_version>FORMAT_VERSION)throw Error('El ledger usa una versión futura.');
  }finally{probe.close();}
 }
 if(dbPath!==':memory:')mkdirSync(dirname(resolve(dbPath)),{recursive:true});
 const db=new DatabaseSync(dbPath);let closed=false;
 const transaction=work=>{db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 const metadata={formatVersion:String(FORMAT_VERSION),weights:canonical(ASSESSMENT_WEIGHTS),targets:canonical(ASSESSMENT_TARGETS)};
 const decode=row=>{
  if(!row)return null;const payload=JSON.parse(row.payload_json);
  if(recordHash(row.sequence,row.previous_hash,payload)!==row.record_hash||payload.id!==row.assessment_id||payload.at!==row.created_at||payload.assessment.repository.githubId!==row.repository_id||payload.assessment.categoryId!==row.category_id)throw Error('Integridad del registro de evaluación incorrecta en '+row.sequence+'.');
  return freeze({sequence:row.sequence,id:payload.id,at:payload.at,previousHash:row.previous_hash,hash:row.record_hash,assessment:payload.assessment});
 };
 function verifyIntegrity(){
  let expectedSequence=1,previousHash=ZERO_HASH,count=0;
  try{
   const quick=db.prepare('PRAGMA quick_check').all();if(quick.length!==1||quick[0].quick_check!=='ok')throw Error('SQLite quick_check falló.');
   for(const [key,value] of Object.entries(metadata))if(db.prepare('SELECT value FROM assessment_meta WHERE key=?').get(key)?.value!==value)throw Error('Metadatos del ledger incompatibles.');
   for(const [name,definition] of Object.entries(triggerDefinitions))if(normalizedSql(db.prepare("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name=?").get(name)?.sql)!==normalizedSql(definition))throw Error('Una protección append-only falta o ha sido alterada.');
   for(const row of db.prepare('SELECT * FROM assessment_records ORDER BY sequence').iterate()){
    if(row.sequence!==expectedSequence||row.previous_hash!==previousHash)throw Error('Cadena discontinua en '+row.sequence+'.');const record=decode(row);previousHash=record.hash;expectedSequence++;count++;
   }
   return {ok:true,records:count,headHash:previousHash,method:'SQLite quick_check + SHA256 chained canonical JSON',authenticated:false};
  }catch(error){return {ok:false,records:count,headHash:previousHash,error:String(error.message),authenticated:false};}
 }
 try{
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  transaction(()=>{db.exec(schema);for(const [key,value] of Object.entries(metadata))db.prepare('INSERT INTO assessment_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').run(key,value);});
  const integrity=verifyIntegrity();if(!integrity.ok)throw Error('No se abre un ledger sin integridad: '+integrity.error);
 }catch(error){db.close();throw error;}
 function append(input,{assessmentId=randomUUID()}={}){
  if(typeof assessmentId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(assessmentId))throw Error('assessmentId inválido.');
  const assessment=evaluateRepositoryAssessment(input,{now}),payload={id:assessmentId,at:assessment.evaluatedAt,assessment};
  return transaction(()=>{
   const integrity=verifyIntegrity();if(!integrity.ok)throw Error('Integridad del ledger incorrecta: '+integrity.error);
   const last=db.prepare('SELECT * FROM assessment_records ORDER BY sequence DESC LIMIT 1').get();if(last)decode(last);
   const sequence=(last?.sequence??0)+1,previousHash=last?.record_hash??ZERO_HASH,record_hash=recordHash(sequence,previousHash,payload);
   db.prepare('INSERT INTO assessment_records(sequence,assessment_id,repository_id,category_id,created_at,previous_hash,record_hash,payload_json) VALUES(?,?,?,?,?,?,?,?)').run(sequence,assessmentId,assessment.repository.githubId,assessment.categoryId,payload.at,previousHash,record_hash,canonical(payload));
   return decode(db.prepare('SELECT * FROM assessment_records WHERE sequence=?').get(sequence));
  });
 }
 function get(id){if(typeof id==='number'){if(!Number.isSafeInteger(id)||id<1)throw Error('Secuencia inválida.');return decode(db.prepare('SELECT * FROM assessment_records WHERE sequence=?').get(id));}if(typeof id!=='string'||id.length>80)throw Error('assessmentId inválido.');return decode(db.prepare('SELECT * FROM assessment_records WHERE assessment_id=?').get(id));}
 function list({repositoryId=null,categoryId=null,limit=40,offset=0}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>200||!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw Error('Paginación fuera de límites.');
  const filters=[],args=[];if(repositoryId!==null){if(!Number.isSafeInteger(repositoryId)||repositoryId<1)throw Error('repositoryId inválido.');filters.push('repository_id=?');args.push(repositoryId);}if(categoryId!==null){filters.push('category_id=?');args.push(category(categoryId));}const where=filters.length?' WHERE '+filters.join(' AND '):'';
  return {total:db.prepare('SELECT COUNT(*) n FROM assessment_records'+where).get(...args).n,limit,offset,items:db.prepare('SELECT * FROM assessment_records'+where+' ORDER BY sequence DESC LIMIT ? OFFSET ?').all(...args,limit,offset).map(decode)};
 }
 return Object.freeze({append,get,list,verifyIntegrity,close:()=>{if(!closed){db.close();closed=true;}}});
}
