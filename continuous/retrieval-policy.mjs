import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const present=value=>value!==undefined&&value!==null&&value!=='';
const timestamp=value=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()?Date.parse(value):NaN;
const knownVisibility=new Set(['public','owner','private','subjects']);
const secretParameter=/^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|auth(?:orization)?|token|key|password|passwd|pass|pwd|secret|client[-_]?secret|sig(?:nature)?|x-amz-.+|x-goog-.+)$/i;
function credentialAddress(value){
 try{const url=new URL(value);return !!(url.username||url.password)||[...url.searchParams.keys()].some(key=>secretParameter.test(key));}catch{return false;}
}
const revoked=doc=>doc.deleted===true||doc.tombstone===true||present(doc.deletedAt)||present(doc.supersededBy)||['deleted','tombstone','revoked','superseded'].includes(doc.status);

/** These fields are trusted ingestion metadata, never instructions extracted
 * from document text. The default preserves the historical owner-only corpus. */
export function retrievalContext(options={}){
 if(!object(options)||Object.keys(options).some(key=>!['includeReferences','audience','subjectId','now'].includes(key)))throw new TypeError('Opciones de búsqueda no válidas.');
 const {includeReferences=false,audience='owner',subjectId=null,now=Date.now()}=options;
 if(typeof includeReferences!=='boolean')throw new TypeError('includeReferences debe ser booleano.');
 if(!['owner','shared'].includes(audience)||subjectId!==null&&(typeof subjectId!=='string'||!subjectId.trim()||subjectId.length>128)||!Number.isFinite(timestamp(now)))throw new TypeError('Ámbito de búsqueda no válido.');
 return {includeReferences,audience,subjectId,now:timestamp(now)};
}

function permitted(doc,context){
 if(!object(doc)||!['train',...(context.includeReferences?['reference']:[])].includes(doc.role))return false;
 // A minimal authorized tombstone need not retain the deleted text or URL.
 // It still participates in version selection so older content stays revoked.
 if((typeof doc.text!=='string'||typeof doc.url!=='string')&&!(revoked(doc)&&canonicalId(doc)))return false;
 // Keep historical local identifiers, but never forward executable URLs.
 if(/^\s*(?:javascript|data|vbscript):/i.test(doc.url)||credentialAddress(doc.url))return false;
 if(present(doc.access)&&!object(doc.access))return false;
 const access=doc.access||{};
 if(Object.keys(access).some(key=>!['visibility','subjectIds'].includes(key)))return false;
 if(present(access.visibility)&&present(doc.visibility)&&access.visibility!==doc.visibility)return false;
 const visibility=access.visibility??doc.visibility;
 if(present(visibility)&&!knownVisibility.has(visibility))return false;
 if(context.audience==='shared'&&visibility!=='public')return false;
 if(context.audience!=='owner'&&['owner','private'].includes(visibility))return false;
 if(present(doc.ownerId)&&doc.ownerId!==context.subjectId)return false;
 const subjectLists=[access.subjectIds,doc.subjectIds].filter(value=>value!==undefined);
 if(subjectLists.some(subjects=>!Array.isArray(subjects)||!subjects.length||subjects.some(value=>typeof value!=='string'||!value)||!context.subjectId||!subjects.includes(context.subjectId)))return false;
 if(visibility==='subjects'&&!subjectLists.length)return false;
 return true;
}

function dateState(doc,context){
 for(const field of ['validFrom','validUntil','expiresAt'])if(present(doc[field])&&!Number.isFinite(timestamp(doc[field])))return 'invalid';
 if(present(doc.validFrom)&&timestamp(doc.validFrom)>context.now)return 'future';
 if(['validUntil','expiresAt'].some(field=>present(doc[field])&&timestamp(doc[field])<=context.now))return 'expired';
 return 'current';
}

function current(doc,context){
 if(revoked(doc))return false;
 if(present(doc.status)&&!['active','current'].includes(doc.status))return false;
 return dateState(doc,context)==='current';
}

function version(value){
 if(Number.isSafeInteger(value)&&value>=0)return [value,0,0];
 if(typeof value==='string'&&/^\d+(?:\.\d+){0,2}$/.test(value)){const parts=value.split('.').map(Number);if(parts.every(Number.isSafeInteger))return [...parts,...Array(3-parts.length).fill(0)];}
 return null;
}
function compareVersion(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;}
const canonicalId=doc=>typeof (doc.canonicalId??doc.documentId)==='string'&&(doc.canonicalId??doc.documentId).trim()?(doc.canonicalId??doc.documentId):null;

/** ACL is applied before version selection and before ranking. Latest explicit
 * versions/tombstones cannot silently resurrect older expired/deleted content.
 * fetchedAt is provenance only, never a factual-validity or version signal. */
export function selectRetrievalDocuments(documents,context){
 const permittedRows=documents.filter(doc=>permitted(doc,context)),groups=new Map(),ungrouped=[];
 for(const doc of permittedRows){const id=canonicalId(doc);if(!id){ungrouped.push(doc);continue;}if(!groups.has(id))groups.set(id,[]);groups.get(id).push(doc);}
 const selected=[...ungrouped];
 for(const group of groups.values()){
  const eligible=group.filter(doc=>!['invalid','future'].includes(dateState(doc,context)));
  if(!eligible.length)continue;
  const versions=eligible.map(doc=>version(doc.version));
  if(versions.every(Boolean)){
   const newest=versions.reduce((best,item)=>compareVersion(item,best)>0?item:best);
   const latest=eligible.filter((doc,index)=>compareVersion(versions[index],newest)===0);
   // Conflicting same-version tombstones revoke the whole logical record.
   if(latest.every(doc=>current(doc,context)))selected.push(...latest);
  }else if(eligible.some(revoked))continue;
  else if(eligible.length===1)selected.push(eligible[0]);
  else {const explicitCurrent=eligible.filter(doc=>doc.status==='current');if(explicitCurrent.length===1)selected.push(explicitCurrent[0]);}
 }
 return selected.filter(doc=>current(doc,context));
}

/** A clickable citation is narrower than a legacy source identifier. No
 * network/DNS request is made here; this is not a safe-fetch/SSRF boundary. */
export function publicCitationUrl(value){
 let url;try{url=new URL(value);}catch{return null;}
 if(!['http:','https:'].includes(url.protocol)||credentialAddress(value))return null;
 const hostname=url.hostname.toLowerCase().replace(/^\[|\]$/g,'').replace(/\.$/,'');
 // IP literals and local/single-label names cannot become public citations.
 if(!hostname.includes('.')||isIP(hostname)||hostname==='localhost'||/\.(?:localhost|local|internal|test|invalid|onion)$/.test(hostname))return null;
 // Retain meaningful query parameters, ports and fragments exactly as URL
 // normalization permits; removing them could cite a different resource.
 return url.href;
}

export function retrievalProvenance(doc){
 const contentHash=createHash('sha256').update(doc.text).digest('hex');
 const id='source-'+createHash('sha256').update(JSON.stringify([doc.id??null,doc.url,doc.version??null,contentHash])).digest('hex').slice(0,20);
 const url=publicCitationUrl(doc.url);
 return {sourceId:id,contentHash,canonicalId:canonicalId(doc),version:doc.version??null,validFrom:doc.validFrom??null,validUntil:doc.validUntil??doc.expiresAt??null,verification:'unverified-source',citation:url?{id,url,kind:'source-provenance',verified:false}:null};
}
