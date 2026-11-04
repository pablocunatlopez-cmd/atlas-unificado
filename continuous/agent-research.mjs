const QUERIES=Object.freeze(['agent','claude','coding']);
const PROVIDERS=Object.freeze(['native','aider','smolagents']);
const ADAPTER_REPOSITORIES=Object.freeze({'aider-ai/aider':'aider','huggingface/smolagents':'smolagents'});
const SCOPE='Candidatos de la biblioteca GitHub local, no los mejores agentes medidos. La relevancia, recencia y licencia comunicada ayudan a priorizar una revisión; las estrellas no prueban calidad. No se instala, descarga ni ejecuta código. Un SDK de Claude no proporciona acceso al modelo ni una conexión gratuita.';
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const boundedText=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1e9?value:null;
const observedTime=value=>{const time=Date.parse(value||'');return Number.isFinite(time)?time:-Infinity;};
function stamp(value,latest=Infinity){
 if(typeof value!=='string'||value.length>64)return null;
 const time=Date.parse(value);return Number.isFinite(time)&&time<=latest?new Date(time).toISOString():null;
}
function instant(value){const time=typeof value==='function'?value():value;if(!Number.isFinite(time)||!Number.isFinite(new Date(time).getTime()))throw new TypeError('Se requiere un reloj válido para la investigación de agentes.');return time;}
function repositoryUrl(value){
 if(typeof value!=='string'||value.length>300)return null;
 try{
  const url=new URL(value),parts=url.pathname.replace(/\/$/,'').split('/').slice(1);
  if(url.protocol!=='https:'||url.hostname!=='github.com'||url.username||url.password||url.port||url.search||url.hash||parts.length!==2)return null;
  const [owner,repo]=parts;
  if(!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner)||!/^[A-Za-z0-9_.-]{1,100}$/.test(repo)||['.','..'].includes(repo)||/\.git$/i.test(repo))return null;
  const repository=(owner+'/'+repo).toLowerCase();return {repository,url:'https://github.com/'+repository};
 }catch{return null;}
}
function metadataSource(value,repository,{search=false}={}){
 if(typeof value!=='string'||value.length>2048)return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='api.github.com'||url.username||url.password||url.port||url.hash)return null;
  if(search)return url.pathname==='/search/repositories'?'https://api.github.com/search/repositories':null;
  return !url.search&&url.pathname.toLowerCase()==='/repos/'+repository?'https://api.github.com/repos/'+repository:null;
 }catch{return null;}
}
// Common unambiguous SPDX identifiers only. An unrecognised identifier remains
// unknown here; a reported identifier never grants permission to reuse code.
function spdx(value){return typeof value==='string'&&/^(?:MIT|Apache-2\.0|BSD-[23]-Clause|MPL-2\.0|ISC|Unlicense|CC0-1\.0|(?:A?GPL|LGPL)-(?:2\.0|2\.1|3\.0)(?:-only|-or-later)?|CC-BY(?:-SA)?-4\.0)$/.test(value)?value:null;}
function licenseMetadata(record,metadata,repository,time){
 const proof=object(record.licenseVerification)?record.licenseVerification:{},sourceUrl=metadataSource(proof.sourceUrl,repository),at=stamp(proof.verifiedAt,time);
 const verified=spdx(record.verifiedLicense);
 if(verified&&sourceUrl&&at&&record.verificationStatus==='verified'&&stamp(record.metadataVerifiedAt,time))return {spdxId:verified,sourceUrl,at,verification:'github-rest-metadata'};
 const search=object(record.searchSource)?record.searchSource:{},searchUrl=metadataSource(search.url,repository,{search:true}),seen=stamp(search.at,time)||stamp(record.lastSeenAt,time),reported=spdx(metadata.license?.spdxId);
 if(record.evidence==='C'&&searchUrl&&seen&&reported)return {spdxId:reported,sourceUrl:searchUrl,at:seen,verification:'github-search-metadata'};
 return null;
}
function collaboratorStatuses(value){
 const input=object(value)?value:{};
 return PROVIDERS.map(id=>{
  const status=object(input[id])?input[id]:{},installed=status.installed===true;
  return {id,installed,ready:installed&&status.ready===true,busy:installed&&status.busy===true,inferenceVerified:installed&&status.inferenceVerified===true,model:'Qwen local',independentModel:false};
 });
}
function candidate(record,time){
 if(!object(record))return null;
 const identity=repositoryUrl(record.url),metadata=object(record.metadata)?record.metadata:{};
 if(!identity||metadata.archived===true||metadata.disabled===true||metadata.private===true||record.archived===true||record.disabled===true||record.private===true)return null;
 const {repository,url}=identity;
 if(record.owner!==undefined&&record.repo!==undefined&&(String(record.owner)+'/'+String(record.repo)).toLowerCase()!==repository)return null;
 if(metadata.fullName!==undefined&&(typeof metadata.fullName!=='string'||metadata.fullName.toLowerCase()!==repository))return null;
 if(metadata.htmlUrl!==undefined&&repositoryUrl(metadata.htmlUrl)?.repository!==repository)return null;
 const topic=(repository+' '+boundedText(record.description,4000)+' '+boundedText(metadata.description,4000)+' '+(Array.isArray(metadata.topics)?metadata.topics.filter(item=>typeof item==='string').slice(0,50).map(item=>item.slice(0,80)).join(' '):'')).toLowerCase();
 const relevance=[];
 if(/(?:coding[ -]?agent|code[ -]?agent|agentic[ -]?cod|aider|smolagents|swe[ -]?agent|software[ -]?engineering[ -]?agent)/.test(topic))relevance.push('coding-agent');
 if(/(?:\bagents?\b|multiagent|langgraph|autogen)/.test(topic))relevance.push('agent-framework');
 if(/(?:local[ -]?(?:llm|model|inference)|ollama|llama\.cpp|\bqwen\b)/.test(topic))relevance.push('local-model');
 if(/\bclaude\b|anthropics\//.test(topic))relevance.push('claude-reference');
 if(!relevance.length)return null;
 const reasons=[],weights={'coding-agent':6,'agent-framework':3,'local-model':3,'claude-reference':2};let score=0;
 for(const kind of relevance){score+=weights[kind];reasons.push(kind+'-relevance');}
 if(Object.hasOwn(ADAPTER_REPOSITORIES,repository)){score+=4;reasons.push('existing-adapter-reference');}
 const lastPushAt=stamp(metadata.pushedAt,time),age=lastPushAt?time-Date.parse(lastPushAt):Infinity;
 if(age<=180*86400000){score+=2;reasons.push('recent-activity-metadata');}else if(age<=730*86400000){score++;reasons.push('activity-within-two-years');}
 const license=licenseMetadata(record,metadata,repository,time);
 if(license){score++;reasons.push('license-metadata-available');}
 const observedAt=stamp(record.metadataVerifiedAt,time)||stamp(record.searchSource?.at,time)||stamp(record.lastSeenAt,time);
 return {repository,url,relevance,rank:{score,reasons,measuredQuality:false},metadata:{stars:count(metadata.stars),lastPushAt,observedAt,license},evaluation:'reference-only',executionVerified:false};
}

/** Pure ranking of already collected public metadata. No description, query,
 * raw claim, error or caller-provided provider name is copied into the result.
 */
export function buildAgentResearch({repositories=[],collaborators={},now=Date.now()}={}){
 const time=instant(now),unique=new Map();
 for(const record of (Array.isArray(repositories)?repositories:[]).slice(0,120)){
  const item=candidate(record,time);if(!item)continue;
  const prior=unique.get(item.url);
  if(!prior||item.rank.score>prior.rank.score||item.rank.score===prior.rank.score&&observedTime(item.metadata.observedAt)>observedTime(prior.metadata.observedAt))unique.set(item.url,item);
 }
 return {version:1,at:new Date(time).toISOString(),status:'ready',localCollaborators:collaboratorStatuses(collaborators),candidates:[...unique.values()].sort((a,b)=>b.rank.score-a.rank.score||a.url.localeCompare(b.url)).slice(0,6),externalModels:{claude:{connected:false,requiresOwnAuthentication:true,sdkIsModelAccess:false}},scope:SCOPE};
}

/** The callbacks read the existing local catalogue/status. Only fixed local
 * terms are sent to the catalogue: no private prompt, URL or remote search.
 */
export function createAgentResearch({listRepositories,getCollaborators,now=Date.now}={}){
 if(typeof listRepositories!=='function'||typeof getCollaborators!=='function'||typeof now!=='function')throw new TypeError('Se requieren lectores locales de repositorios y colaboradores.');
 return async function research({signal}={}){
  signal?.throwIfAborted();const repositories=[];let completed=0,collaborators={},collaboratorsRead=false;
  for(const query of QUERIES){
   signal?.throwIfAborted();
   try{const result=await listRepositories({query,limit:40,offset:0},{signal});signal?.throwIfAborted();if(!Array.isArray(result?.items))continue;repositories.push(...result.items.slice(0,40));completed++;}catch{signal?.throwIfAborted();}
  }
  try{collaborators=await getCollaborators({signal});signal?.throwIfAborted();collaboratorsRead=object(collaborators);}catch{signal?.throwIfAborted();}
  const result=buildAgentResearch({repositories,collaborators,now:now()});
  result.status=completed===QUERIES.length&&collaboratorsRead?'ready':completed||collaboratorsRead?'partial':'unavailable';
  return result;
 };
}
