import {sanitizeLearningStatus} from './learning-status.mjs';
import {sanitizeExperienceStatus} from './experience-status.mjs';
export const PROCESS_CATALOG=Object.freeze({experience:{room:'mind',label:'Espiral de experiencia'},suceso:{room:'constellation',label:'Dios · Suceso'},chat:{room:'salon',label:'Conversación'},research:{room:'mind',label:'Observación de fuentes'},tools:{room:'body',label:'Ion · herramientas'},review:{room:'refutation',label:'Tribunal de refutación'},video:{room:'cinema',label:'Generación de vídeo'},creative:{room:'games',label:'Arquitecto 3D'},core:{room:'language',label:'Núcleo de estrategias'},external:{room:'constellation',label:'Perspectivas externas'},lor:{room:'language',label:'Experimento LOR-ΩΣ'},weights:{room:'refutation',label:'Pesos Qwen · laboratorio'},agents:{room:'constellation',label:'Agentes programadores'}});
const states=new Set(['idle','running','passed','failed','waiting']),phases=new Set(['observe','understand','connect','apply','refute','retain']);
const count=value=>Number.isSafeInteger(value)&&value>=0?Math.min(value,1000000000):undefined;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const researchStates=new Set(['ready','partial','unavailable']);
const researchReasons=new Set(['coding-agent-relevance','agent-framework-relevance','local-model-relevance','claude-reference-relevance','existing-adapter-reference','recent-activity-metadata','activity-within-two-years','license-metadata-available']);
const researchDate=(value,latest=Infinity)=>{if(typeof value!=='string'||value.length>64)return null;const time=Date.parse(value);return Number.isFinite(time)&&time<=latest?new Date(time).toISOString():null;};
const taskFamilies=['lor-omega-schema','json-pointer-resolve','dag-dependency-plan','merge-intervals','stable-dedupe','numeric-statistics','json-patch-apply','csv-parse'];
function publicRepository(value){
 if(typeof value!=='string'||value.length>300)return null;
 const match=/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9_.-]{1,100})\/?$/.exec(value);
 if(!match||['.','..'].includes(match[2])||/\.git$/i.test(match[2]))return null;
 const repository=(match[1]+'/'+match[2]).toLowerCase();return {repository,url:'https://github.com/'+repository};
}
export function sanitizeAgentResearchStatus(value){
 if(!record(value)||!researchStates.has(value.status)||!Array.isArray(value.candidates))return null;
 if(value.version!==undefined?value.version!==1:value.basis!=='public-repository-metadata'||value.executionVerified!==false||value.claudeConnected!==false)return null;
 const at=researchDate(value.at);if(!at)return null;
 const candidates=[],seen=new Set(),latest=Date.parse(at);
 for(const item of value.candidates.slice(0,64)){
  if(!record(item)||item.private===true||item.archived===true||item.disabled===true||item.visibility==='private'||item.metadata?.private===true||item.metadata?.archived===true||item.metadata?.disabled===true||item.metadata?.visibility==='private')continue;
  const identity=publicRepository(item.url),score=item.rank?.score;
  if(!identity||typeof item.repository!=='string'||item.repository.toLowerCase()!==identity.repository||seen.has(identity.repository)||typeof score!=='number'||!Number.isFinite(score)||score<0||score>30)continue;
  const reasons=Array.isArray(item.rank?.reasons)?[...new Set(item.rank.reasons.slice(0,32).filter(reason=>researchReasons.has(reason)))]:[];
  const rawLicense=item.metadata?.license;
  const license=record(rawLicense)&&typeof rawLicense.spdxId==='string'&&/^(?:MIT|Apache-2\.0|BSD-[23]-Clause|MPL-2\.0|ISC|Unlicense|CC0-1\.0|(?:A?GPL|LGPL)-(?:2\.0|2\.1|3\.0)(?:-only|-or-later)?|CC-BY(?:-SA)?-4\.0)$/.test(rawLicense.spdxId)&&['github-rest-metadata','github-search-metadata'].includes(rawLicense.verification)?{spdxId:rawLicense.spdxId,verification:rawLicense.verification}:null;
  candidates.push({...identity,rank:{score,reasons,measuredQuality:false},metadata:{lastPushAt:researchDate(item.metadata?.lastPushAt,latest),observedAt:researchDate(item.metadata?.observedAt,latest),...(license?{license}:{})}});seen.add(identity.repository);
  if(candidates.length===6)break;
 }
 return {at,status:value.status,candidates,candidateCount:candidates.length,basis:'public-repository-metadata',executionVerified:false,claudeConnected:false};
}
function taskSelection(value){
 let selectionByTask=false,measuredTaskTypes=0;
 if(value.measurementScope==='builder-contracts'&&record(value.taskMetrics)){
  selectionByTask=true;
  measuredTaskTypes=taskFamilies.filter(id=>record(value.taskMetrics[id])&&['aider','smolagents','native'].some(provider=>{const stat=value.taskMetrics[id][provider];return record(stat)&&Number.isSafeInteger(stat.attempts)&&stat.attempts>0&&stat.attempts<=1000000000;})).length;
 }else if(value.scope==='builder-contracts'&&value.selectionByTask===true&&Number.isInteger(value.measuredTaskTypes)&&value.measuredTaskTypes>=0&&value.measuredTaskTypes<=8){selectionByTask=true;measuredTaskTypes=value.measuredTaskTypes;}
 return {selectionByTask,measuredTaskTypes,...(selectionByTask?{scope:'builder-contracts'}:{})};
}
export function sanitizePublicDocsStatus(value){
 if(value?.serverId!=='openai-docs'||value.readOnly!==true)return null;
 const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
 return {serverId:'openai-docs',name:'OpenAI Docs MCP',connected:value.connected===true,readOnly:true,apiKeyRequired:false,searchAvailable:value.connected===true&&value.searchAvailable===true,toolCount:Math.min(192,count(value.toolCount)??(Array.isArray(value.tools)?value.tools.length:0)),checkedAt:date(value.checkedAt),lastSearchAt:date(value.lastSearchAt)};
}
export function sanitizeProcessTelemetry(value){
 if(!value||typeof value!=='object')return null;
 const processes=Array.isArray(value.processes)?value.processes.slice(0,16).filter(item=>item&&PROCESS_CATALOG[item.id]&&states.has(item.state)).map(item=>{
  const counters={};for(const key of ['observations','trials','accepted','rejected']){const n=count(item.counters?.[key]);if(n!==undefined)counters[key]=n;}
  return {id:item.id,...PROCESS_CATALOG[item.id],state:item.state,...(phases.has(item.phase)?{phase:item.phase}:{}),counters};
 }):[];
 const c=value.core||{},core={generation:count(c.generation)||0,attempts:count(c.attempts)||0,accepted:count(c.accepted)||0,rejected:count(c.rejected)||0,qwenWeightsChanged:false,method:'StrategyPolicy',version:typeof c.version==='string'&&/^[a-zA-Z0-9._-]{1,100}$/.test(c.version)?c.version:'baseline'};
 const at=typeof value.at==='string'&&Number.isFinite(Date.parse(value.at))?new Date(value.at).toISOString():null;
 const l=value.lor||{},verdict=['SUPPORTED','TENTATIVE','REDUNDANT','NULL_LIKE','INSUFFICIENT_EVIDENCE','REFUTED','ABSTAIN'].includes(l.verdict)?l.verdict:null;
 const metric=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(-10,Math.min(10,v)):null;
 const e=value.evolution,d=e?.download||{},bytes=value=>Number.isSafeInteger(value)&&value>=0?Math.min(value,100000000000):0;
 const evolution=e?{model:'Qwen3.5-9B',prepared:e.prepared===true,ready:e.ready===true,activeAdapter:false,candidatesPrepared:count(e.candidatesPrepared)||0,candidatesTrained:count(e.candidatesTrained)||0,download:{status:['downloading','verifying','verified','completed','failed','error'].includes(d.status)?d.status:'pending',downloadedBytes:bytes(d.downloadedBytes),totalBytes:bytes(d.totalBytes)},experimentalQuantization:true}:null;
 const providerStats=value=>({installed:value?.installed===true,ready:value?.ready===true,inferenceVerified:value?.inferenceVerified===true,attempts:count(value?.attempts)||0,passed:count(value?.passed)||0,failed:count(value?.failed)||0,meanMs:count(value?.attempts)>0&&Number.isFinite(value?.totalMs)?Math.max(0,Math.round(value.totalMs/value.attempts)):count(value?.meanMs)??null});
 const agents=value.agents?{aider:providerStats(value.agents.aider),smolagents:providerStats(value.agents.smolagents),native:providerStats(value.agents.native),independentModels:0,automatic:true,...taskSelection(value.agents)}:null;
 return {at,processes,core,evolution,agents,research:sanitizeAgentResearchStatus(value.research),publicDocs:sanitizePublicDocsStatus(value.publicDocs),learning:sanitizeLearningStatus(value.learning),experience:sanitizeExperienceStatus(value.experience),lor:verdict?{verdict,baseline:metric(l.baseline),score:metric(l.score),delta:metric(l.delta),negativeControlDelta:metric(l.negativeControlDelta),synthetic:true}:null};
}
