import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {TinyLanguageModel,validateSnapshot} from '../public/core/language-model.mjs';
import {hash,extractText,discoverLinks,searchDocuments,normalizeLearnableUrl} from './engine.mjs';
import {compareCandidates,workerBudget} from './parallel.mjs';
import {inherited,spiralRecord,discoverFoundationImages} from './spiral.mjs';
import {compareGpu} from './gpu.mjs';
import {testGame} from './devtools.mjs';
import {makeClaim} from './refutation.mjs';
import {chat,validateMessages,validateAttachments,memoryQuery} from './chat.mjs';
import {useExtension} from './agent-tools.mjs';
import {starCatalog} from './constellation.mjs';
import {buildExtension,improveExtension,executePure} from './extensions.mjs';
import {reviewCapabilities} from './autonomous-review.mjs';
import {retainContract} from './tool-contract.mjs';
import {gameLibrary,readGameImage,gameLibraryContext} from './game-library.mjs';
import {googleSearchStatus,webEvidence} from './internet.mjs';
import {sourceDescriptor,extractUserSourceUrls,fetchUserReference,trainingDocuments} from './user-sources.mjs';
import {librarySummary,listLibrary,refreshNextRepository,importRepositoryCatalog} from './repo-library.mjs';
import {assessCapabilities} from './audit-assessment.mjs';
import {reflectRepository,repositoryReflectionId} from './repository-reflections.mjs';
import {backupRepositoryLibrary} from './backup-library.mjs';
import {discoverySummary,listDiscovered,discoverNextRepositories,loadRepositoryTaxonomy} from './repository-discovery.mjs';
import {secondaryStatus,runSecondary,resolveSecondaryArtifact,searchSecondaryMemory} from './secondary-atlas.mjs';
import {projectCommand,answerProjectCommand} from './project-actions.mjs';
import {spawn} from 'node:child_process';
import {createGpuLease} from './gpu-lease.mjs';
import {videoStatus,startVideoRuntime,generateVideo,releaseVideoRuntime,resolveVideoArtifact,videoOptions} from './atlas-video-tools.mjs';
import {createCognitiveCore} from './cognitive-core.mjs';
import {createLorLab} from './lor-lab.mjs';
import {sanitizeProcessTelemetry} from './process-telemetry.mjs';
import {createQwenEvolution} from './qwen-evolution.mjs';
import {createLocalCodingAgent} from './local-coding-agent.mjs';
import {createSmolCodingAgent} from './smol-coding-agent.mjs';
import {createCodingCollaborators} from './coding-collaborators.mjs';
import {createCodingReferences} from './coding-references.mjs';
import {createWeightAutonomy} from './weight-autonomy.mjs';
import {publicTools,publicToolIntent} from './public-tools.mjs';
import {sanitizeLearningTelemetry} from './learning-telemetry.mjs';
import {selectAutonomousTask} from './autonomy-curriculum.mjs';
import {createExperienceRuntime} from './experience-runtime.mjs';
import {createCreativeExperience} from './experience-creative.mjs';
import {atlasApplicationCapabilities} from './atlas-capabilities.mjs';
import {atlasIdentityPrompt} from './atlas-identity.mjs';
import {createPublicMcp} from './public-mcp.mjs';
import {createAtlasEvidence} from './docs-evidence.mjs';
import {createGuidedEvidence} from './guided-evidence.mjs';
const publicDocs=createPublicMcp();
const atlasEvidence=createAtlasEvidence({publicDocs,web:webEvidence,guided:createGuidedEvidence({read:webEvidence})});
void publicDocs.discover().catch(()=>{});
let chatBusy=false,creativeTask=null;
let mediaBusy=false,mediaAbort=null,mediaProgress=null,gpuActivity=null,autonomousWeights=false,mediaDone=Promise.resolve();
const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.join(root,'data');
const cognitiveCore=createCognitiveCore({directory:path.join(data,'cognitive-core')});
const lorLab=createLorLab();
const qwenEvolution=createQwenEvolution();
const weightAutonomy=createWeightAutonomy({directory:data,evolution:qwenEvolution,runExclusive:runAutonomousWeightCandidate});
let coreReviewBusy=false,lorBusy=false,coreAbort=null,corePhase='retain';
const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
// Ignore inherited streams and await the launcher exit. A detached llama child
// can otherwise keep execFile's pipe handles open after PowerShell has exited.
const modelScript=name=>new Promise((resolve,reject)=>{
 const child=spawn(powershell,['-NoProfile','-File',path.join(root,name)],{windowsHide:true,stdio:'ignore',shell:false});
 const timer=setTimeout(()=>{child.kill();reject(Error('El cambio de motor agotó su tiempo de espera.'));},180000);
 child.once('error',error=>{clearTimeout(timer);reject(error);});
 child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Falló el cambio de motor local ('+name+').'));});
});
const gpuLease=createGpuLease({directory:data,suspend:()=>modelScript('Suspend-Atlas-Model.ps1'),release:releaseVideoRuntime,restore:()=>modelScript('Start-Chat.ps1'),shouldRestore:async()=>{try{await fs.access(path.join(data,'service.stop'));return false;}catch{return !closing;}}});
let chatModelName='Qwen3-4B-Instruct-2507 Q4_K_M';
try{chatModelName=(await fs.readFile(path.join(data,'active-chat-model.txt'),'utf8')).trim()||chatModelName;}catch{}
const chatKey=(await fs.readFile(path.join(data,'chat-local.key'),'utf8')).trim();
const localCodingAgent=createLocalCodingAgent({key:chatKey});
const smolCodingAgent=createSmolCodingAgent({key:chatKey});
const codingReferences=createCodingReferences({directory:data});
const codingCollaborators=createCodingCollaborators({directory:data,agent:localCodingAgent,smolAgent:smolCodingAgent,referenceLibrary:codingReferences});
const providerKeyPath=path.join(data,'openrouter.key');
let providerKey='';try{providerKey=(await fs.readFile(providerKeyPath,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;}
let extensionBusy=false;
await fs.mkdir(data,{recursive:true});
let foundationImages=await discoverFoundationImages(data);
const config=JSON.parse(await fs.readFile(path.join(root,'config.json'),'utf8'));
const mandate=await fs.readFile(path.join(root,'ATLAS_MANDATO_UNIFICADO.md'),'utf8');
const mandateHash=hash(mandate);
const read=async(name,fallback)=>{try{return JSON.parse(await fs.readFile(path.join(data,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
let writes=Promise.resolve();
function write(name,value){
 const serialized=JSON.stringify(value,null,2);
 const operation=writes.then(async()=>{const file=path.join(data,name);await fs.writeFile(file+'.tmp',serialized);await fs.rename(file+'.tmp',file);});
 writes=operation.catch(()=>{});return operation;
}
let state=await read('state.json',{paused:false,cycles:0,accepted:0,rejected:0,attempted:[],checked:{},events:[]});
let documents=await read('documents.json',[]);
try{importRepositoryCatalog(await fs.readFile(path.join(data,'biblioteca-github-instrucciones-originales.txt'),'utf8'),{sourcePath:'data/biblioteca-github-instrucciones-originales.txt'});}catch(error){if(error.code!=='ENOENT')console.error('Biblioteca: '+error.message);}
let claims=await read('claims.json',[]);
let extensions=await read('extensions.json',[]);
let collaborations=await read('collaborations.json',[]);
let repositoryNotes=await read('repository-reflections.json',[]);
let libraryBackup=await read('library-backup.json',{at:null,lastAttempt:null});
let discoverySchedule=await read('repository-discovery-schedule.json',{nextRun:null});
let gameReferences=null;
let gameRefreshBusy=false;
try{gameReferences=await gameLibrary();await write('game-library.json',gameReferences);}catch(e){gameReferences={games:[],error:e.code||e.message};}
state.discovered??=[];
state.spiral??=[];
state.negativeLessons??=[];
state.sourceHealth??={};
state.inFlightSource??=null;
for(const item of listLibrary({limit:200}).items.filter(item=>item.owner&&item.repo)){
 if([...config.sources,...state.discovered].some(source=>source.url.toLowerCase()===item.url.toLowerCase()))continue;
 if(new Set([...config.sources,...state.discovered].map(source=>source.url)).size>=(config.maxQueuedSources||config.maxDocuments))break;
 state.discovered.push(sourceDescriptor(item.url));
}
let snapshot=await read('checkpoint.json',null);
if(snapshot&&!validateSnapshot(snapshot))throw Error('Checkpoint inválido; se conserva para revisión.');
snapshot??=new TinyLanguageModel().snapshot();
let busy=false,closing=false,timer,server,phase=state.paused?'Pausado':'Preparado',nextRun=null,idleUntil=null;
const token=randomBytes(24).toString('hex');
let autonomousTimer,autonomousBusy=false;
let autonomousAbort=null,autonomousDone=Promise.resolve();
let libraryTimer,libraryBusy=false,libraryAbort=null,libraryNextRun=null;
async function libraryCycle(){
 if(closing)return;
 const scheduleLibrary=delay=>{libraryNextRun=new Date(Date.now()+delay).toISOString();libraryTimer=setTimeout(libraryCycle,delay);};
 if(state.paused||libraryBusy){scheduleLibrary(60000);return;}
 libraryBusy=true;libraryAbort=new AbortController();
 try{
  const result=await refreshNextRepository({signal:libraryAbort.signal});if(result.status==='verified')event('repository','Metadatos públicos contrastados; código y licencia completa pendientes',{url:result.url});
  if(config.repositoryDiscovery!==false&&(!discoverySchedule.nextRun||Date.parse(discoverySchedule.nextRun)<=Date.now())){
   const found=await discoverNextRepositories({signal:libraryAbort.signal});
   const providerNext=Date.parse(found.nextRun||'');
   const interval=Math.max(2,Math.min(1440,Number(config.discoveryIntervalMinutes)||10))*60000;
   discoverySchedule={lastRun:found,nextRun:new Date(Math.max(Date.now()+interval,Number.isFinite(providerNext)&&['backoff','rate_limited','waiting','busy'].includes(found.status)?providerNext:0)).toISOString()};
   await write('repository-discovery-schedule.json',discoverySchedule);
   if(found.added){
    let queued=0;const known=new Set([...config.sources,...state.discovered].map(source=>source.url.toLowerCase()));
    for(const item of listDiscovered({limit:12}).items){if(known.has(item.url.toLowerCase()))continue;if(known.size>=(config.maxQueuedSources||config.maxDocuments))break;state.discovered.push(sourceDescriptor(item.url));known.add(item.url.toLowerCase());queued++;}
    event('discovery',`${found.added} repositorios nuevos localizados; evaluación pendiente`,{url:found.sourceUrl});if(queued)await persist();
   }
  }
  if(Date.now()-Date.parse(libraryBackup.lastAttempt||'1970-01-01')>24*60*60*1000){
   libraryBackup.lastAttempt=new Date().toISOString();await write('library-backup.json',libraryBackup);
   try{const backup=await backupRepositoryLibrary();libraryBackup={...backup,at:new Date().toISOString(),lastAttempt:libraryBackup.lastAttempt};await write('library-backup.json',libraryBackup);event('backup','Respaldo SQLite comprobado con integridad y SHA256');}
   catch(error){event('backup_error',error.message);}
  }
 }
 catch(error){if(!libraryAbort.signal.aborted)event('repository_error',error.message);}
 finally{libraryBusy=false;libraryAbort=null;if(!closing){const next=Date.parse(librarySummary().nextRun||'');scheduleLibrary(Math.max(120000,Number.isFinite(next)?next-Date.now():120000));}}
}
let autonomy=await read('autonomous-review.json',{enabled:true,history:[],nextRun:null});
const experienceEnabled=config.experienceSpiral!==false&&config.autonomousProgramming!==false;
let repositoryPerspectiveBusy=false,lastRepositoryPerspectiveAt=0;
const creativeExperience=createCreativeExperience({directory:path.join(config.experienceRoot||path.join(data,'experience'),'creative'),generate:generatePolicyCandidate});
const experienceRuntime=createExperienceRuntime({directory:config.experienceRoot||path.join(data,'experience'),getTools:async()=>extensions,setTools:async next=>{extensions=next;await write('extensions.json',extensions);},build:(task,cases,options)=>codingCollaborators.build(task,chatKey,cases,input=>chat(input,[],fetch,chatKey,'',null,'',[],'',{signal:options.signal,sharedSession:true,cognitiveCore}),options),generate:generatePolicyCandidate,referenceLibrary:codingReferences,getAgentStatus:codingCollaborators.status,creative:creativeExperience,lookup:atlasEvidence,waitMs:1000});
if(experienceEnabled)autonomy.nextRun=null;
async function generatePolicyCandidate(prompt,{signal}){
 const response=await fetch('http://127.0.0.1:11435/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+chatKey},signal:AbortSignal.any([signal,AbortSignal.timeout(150000)]),body:JSON.stringify({model:'atlas-local',messages:[{role:'system',content:atlasIdentityPrompt+' Tu programa dispone de casa virtual ERAS/Three, estudio Web Audio, prototipos 3D, vídeo local condicionado y ejecutores de funciones/políticas con contratos. La acción concreta depende del ejecutor indicado en la petición. No eres solo texto ni puedes inventar permisos o resultados. Los colaboradores locales comparten Qwen; un MCP documental no es otro modelo. Aplica el marco cuando aclare la tarea, sin añadir filosofía a un contrato de código o JSON.'},{role:'user',content:prompt}],temperature:.2,max_tokens:3500,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_object'}})});
 if(!response.ok)throw Error('El motor local no pudo proponer una política.');const output=await response.json();return output.choices?.[0]?.message?.content;
}
async function runAutonomousWeightCandidate(candidate,{signal}){
 if(mediaBusy||chatBusy||closing)throw Error('La GPU tiene una tarea prioritaria.');
 mediaBusy=true;gpuActivity='training';autonomousWeights=true;mediaAbort=new AbortController();const combined=AbortSignal.any([signal,mediaAbort.signal]);let finish;mediaDone=new Promise(resolve=>finish=resolve);
 try{
  return await gpuLease.run(()=>qwenEvolution.trainCandidate(candidate.id,{signal:combined,onProgress:event=>{if(event.type==='progress')mediaProgress={stage:event.stage,progress:event.progress};}}),{signal:combined,role:'training',onStage:(stage,progress)=>mediaProgress={stage,progress}});
 }finally{mediaBusy=false;gpuActivity=null;autonomousWeights=false;mediaAbort=null;mediaProgress=null;finish();}
}
async function assessLocalCapabilities(evidence,key,request,signal){
 const summary=librarySummary();
 return assessCapabilities({...evidence,repositoryResearch:{counts:summary.counts,lastRun:summary.lastRun,scope:'Consultas del proceso de biblioteca, separadas de las acciones de este diagnóstico.'}},key,request,signal);
}
function matchingRepositoryNotes(question){
 const terms=[...new Set(memoryQuery(question).split(' ').filter(term=>term.length>=4))];if(!terms.length)return [];
 return repositoryNotes.map(note=>{const text=(note.url+' '+note.summary+' '+note.possibleUse).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return {note,score:terms.filter(term=>text.includes(term)).length};}).filter(item=>item.score>=Math.min(2,terms.length)).sort((a,b)=>b.score-a.score).slice(0,2).map(({note})=>({url:note.url,at:note.at,summary:note.summary.slice(0,600),possibleUse:note.possibleUse.slice(0,600),risks:note.risks.slice(0,400),evidence:note.evidence}));
}
function currentLibraryStatus(){
 const base=librarySummary(),discovery=discoverySummary();
 return {...base,counts:{...base.counts,categories:discovery.categories},discovery:{...discovery,enabled:config.repositoryDiscovery!==false,schedulerNextRun:discoverySchedule.nextRun},reflections:repositoryNotes.length,backup:{at:libraryBackup.at,integrity:libraryBackup.integrity},running:libraryBusy,paused:state.paused,nextRun:libraryNextRun||base.nextRun};
}
async function currentProjectStatus(){
 let ready=false;try{ready=(await fetch('http://127.0.0.1:11435/health',{signal:AbortSignal.timeout(2000)})).ok;}catch{}
 const integration=await read('project-unification.json',{}),lab=await secondaryStatus();
 return {canonical:{root,chatUrl:'/chat/',modelName:chatModelName,ready},coordination:{primaryThreadId:null,secondaryThreadId:null,secondaryActive:false,checkedAt:integration.checkedAt,secondaryThreadState:integration.secondaryThreadState||'detenido al integrar'},integration:{...integration,component:lab.component,fileCount:lab.snapshot?.files,manifestSha256:lab.snapshot?.manifestSha256},lab,limitations:['Este chat web usa Qwen local; el chat de Codex sigue siendo un asistente distinto.','El componente importado es un laboratorio pequeño de decisiones y un generador de prototipos por reglas.','Los experimentos no sustituyen automáticamente el modelo conversacional ni modifican pesos de Qwen.']};
}
function combinedLibraryItems(options){
 const requestedLimit=Number(options.limit),requestedOffset=Number(options.offset);
 const limit=Number.isInteger(requestedLimit)?Math.max(1,Math.min(200,requestedLimit)):30,offset=Number.isInteger(requestedOffset)?Math.max(0,Math.min(1000000,requestedOffset)):0;
 const imported=listLibrary({...options,limit,offset}),discovered=listDiscovered({...options,limit,offset:Math.max(0,offset-imported.total)});
 const items=offset<imported.total?[...imported.items,...discovered.items.slice(0,limit-imported.items.length)]:discovered.items;
 return {items,total:imported.total+discovered.total,limit,offset};
}
async function autonomousReview(){
 if(closing)return;
 if(state.paused||busy||chatBusy||extensionBusy||mediaBusy){
  const delay=state.paused?60000:5000;
  autonomy.nextRun=new Date(Date.now()+delay).toISOString();autonomy.waitReason=state.paused?'Pausado por el usuario':chatBusy?'Esperando a que termine el chat':'Esperando recursos locales';
  await write('autonomous-review.json',autonomy);autonomousTimer=setTimeout(autonomousReview,delay);return;
 }
 if(autonomy.nextRun&&Date.parse(autonomy.nextRun)>Date.now()){autonomousTimer=setTimeout(autonomousReview,Math.min(60000,Date.parse(autonomy.nextRun)-Date.now()));return;}
 autonomousBusy=true;extensionBusy=true;delete autonomy.waitReason;
 autonomousAbort=new AbortController();let finishAutonomous;
 autonomousDone=new Promise(resolve=>{finishAutonomous=resolve;});
 try{
  const report=await reviewCapabilities(extensions,chatKey,{signal:autonomousAbort.signal,assess:experienceEnabled?async()=>({diagnosis:'Contratos de las herramientas ejecutados por el coordinador.',limitations:'Superar estos contratos no prueba capacidad general ni cambia pesos.',nextAction:'Formular una nueva experiencia desde hechos, incógnitas y refutaciones.',intervalMinutes:5}):assessLocalCapabilities,allowCreation:config.autonomousProgramming!==false&&!experienceEnabled,history:autonomy.history||[],codeGeneration:true,build:codingCollaborators.build});
  for(const check of report.checks)if(!check.passed){const item=extensions.find(x=>x.id===check.id);if(item)item.passed=false;}
  if(report.candidate)extensions.push(report.candidate);
  await write('extensions.json',extensions);
  if(experienceEnabled){report.assessmentStatus='Comprobación del coordinador; la pregunta y la experiencia tienen su propio registro LOR.';report.experience=await experienceRuntime.tick({signal:autonomousAbort.signal});}
  const coreBefore=await cognitiveCore.status();
  if(!coreBefore.lastCycle||Date.now()-Date.parse(coreBefore.lastCycle.at||'1970-01-01')>30*60000){
   coreReviewBusy=true;
   try{
    report.coreCycles=[];
    for(let attempt=0;attempt<3;attempt++){
     report.coreCycle=await cognitiveCore.propose(generatePolicyCandidate,{signal:autonomousAbort.signal,onStage:phase=>corePhase=phase});report.coreCycles.push(report.coreCycle);
     if(report.coreCycle.accepted)break;
    }
    event('cognitive_core',report.coreCycle.accepted?'Política Atlas mejorada tras ejecutar contratos reservados.':'Política candidata conservada como resultado negativo; versión activa intacta.');
   }finally{coreReviewBusy=false;}
  }
  if(!(await lorLab.status()).last){lorBusy=true;try{report.lor=await lorLab.experiment({signal:autonomousAbort.signal});}finally{lorBusy=false;}}
  report.weightTrial=await weightAutonomy.tick(extensions,{signal:autonomousAbort.signal,isIdle:!chatBusy&&!mediaBusy});
  const reference=documents.find(document=>document.role==='reference'&&/^https:\/\/github\.com\//.test(document.url)&&!repositoryNotes.some(note=>note.id===repositoryReflectionId(document)));
  if(reference&&(!experienceEnabled||Date.now()-lastRepositoryPerspectiveAt>10*60000)){
   repositoryPerspectiveBusy=true;
   try{const note=await reflectRepository(reference,chatKey,{signal:autonomousAbort.signal});repositoryNotes.push(note);repositoryNotes=repositoryNotes.slice(-500);await write('repository-reflections.json',repositoryNotes);report.research={url:note.url,id:note.id,status:note.status};lastRepositoryPerspectiveAt=Date.now();}
   catch(error){autonomousAbort.signal.throwIfAborted();report.research={url:reference.url,error:error.message};}
   finally{repositoryPerspectiveBusy=false;}
  }
  const experienceStatus=experienceEnabled?await experienceRuntime.status():null;
  const nextExperience=experienceStatus?.nextRun||new Date(Date.now()+5000).toISOString();
  if(report.experience?.experience)report.experience={status:report.experience.status,reason:report.experience.reason,id:report.experience.experience.id};
  autonomy={enabled:true,nextRun:experienceEnabled?nextExperience:new Date(Date.now()+report.intervalMinutes*60000).toISOString(),history:[...(autonomy.history||[]).slice(-49),report]};
  event('autonomous_review','Auditoría local completada',{accepted:report.candidate?.passed===true});
 }catch(e){
  if(autonomousAbort.signal.aborted){autonomy.nextRun=new Date(Date.now()+(experienceEnabled?5000:5*60000)).toISOString();event('autonomous_yield','La auditoría cede el motor al chat y se reprograma.');}
  else{autonomy.nextRun=new Date(Date.now()+(experienceEnabled?30000:30*60000)).toISOString();autonomy.lastError=e.message;event('autonomous_review_error',e.message);}
 }
 finally{
  try{await write('autonomous-review.json',autonomy);}catch(e){event('autonomous_review_error','No se pudo guardar la auditoría: '+e.message);}
  finally{extensionBusy=false;autonomousBusy=false;autonomousAbort=null;finishAutonomous();if(!closing)autonomousTimer=setTimeout(autonomousReview,Math.max(1000,Math.min(60000,Date.parse(autonomy.nextRun||'')-Date.now()||5000)));}
 }
}
function sitePage(html){
 html=html.replace(/<title>/i,'<link rel="stylesheet" href="/chat/ui.css"><link rel="stylesheet" href="/chat/pages.css"><title>');
 html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="/atlas-theme.css"></head>');
 if(/<\/body>/i.test(html))return html.replace(/<\/body>/i,'<script defer src="/chat/pages.js"></script></body>');
 return html.replace(/<\/html>/i,'<script defer src="/chat/pages.js"></script></html>');
}
function event(kind,message,details={}){
 state.events.unshift({at:new Date().toISOString(),kind,message,...details});state.events=state.events.slice(0,100);
}
function sourceHost(source){return new URL(source.url).hostname.toLowerCase();}
function describeFetchError(error){
 const parts=[],seen=new Set();let current=error,code='';
 for(let depth=0;current&&depth<4&&!seen.has(current);depth++,current=current.cause){
  seen.add(current);const currentCode=typeof current.code==='string'?current.code:'';if(!code&&currentCode)code=currentCode;
  const detail=[current.name,currentCode&&`[${currentCode}]`,current.message].filter(Boolean).join(' ');
  if(detail&&!parts.includes(detail))parts.push(detail);
 }
 return {message:(parts.join(' → ')||String(error)).slice(0,360),code};
}
function isTransientFetchError(error,code=''){
 const transientCodes=new Set(['ETIMEDOUT','ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','UND_ERR_HEADERS_TIMEOUT']);
 if(transientCodes.has(code))return true;
 const text=describeFetchError(error).message;
 return /\bHTTP (?:429|5\d\d)\b|fetch failed|timeout|timed out|temporar(?:y|ily)|socket hang up|network error/i.test(text);
}
function fairSource(ordered){
 const now=Date.now();
 const available=ordered.filter(source=>{
  const retryAt=Date.parse(state.sourceHealth[sourceHost(source)]?.retryAt||'');
  return !Number.isFinite(retryAt)||retryAt<=now;
 });
 const validation=available.filter(source=>source.role==='validation'&&!state.checked[source.url]);
 const training=available.filter(source=>source.role!=='validation'&&!state.checked[source.url]);
 const refresh=available.filter(source=>now-(state.checked[source.url]||0)>config.refreshHours*3600000);
 const candidates=validation.length?validation:training.length?training:refresh;
 if(!candidates.length)return null;
 const firstByHost=new Map();
 for(const source of candidates){const host=sourceHost(source);if(!firstByHost.has(host))firstByHost.set(host,source);}
 return [...firstByHost.entries()].sort((a,b)=>
  (state.sourceHealth[a[0]]?.lastAttempt||0)-(state.sourceHealth[b[0]]?.lastAttempt||0)
 )[0][1];
}
function deferredSources(){
 const now=Date.now();
 return Object.entries(state.sourceHealth||{}).map(([domain,health])=>({domain,...health}))
  .filter(item=>Date.parse(item.retryAt||'')>now).sort((a,b)=>Date.parse(a.retryAt)-Date.parse(b.retryAt));
}
async function persist(){await write('state.json',state);}
if(state.inFlightSource?.url){
 const interrupted=state.inFlightSource;delete state.checked[interrupted.url];
 event('source_retry',`Se reintentará la fuente interrumpida por el reinicio${interrupted.domain?` (${interrupted.domain})`:''}`,{url:interrupted.url});
 state.inFlightSource=null;await persist();
}
async function download(source){
 if(!documents.some(document=>document.url===source.url)&&documents.length>=config.maxDocuments)throw Error('La memoria documental alcanzó su capacidad; se conservan las fuentes existentes.');
 if(source.role==='reference'){
  const document=await fetchUserReference(source,{maxCharacters:config.maxDocumentCharacters});
  const old=documents.find(d=>d.url===document.url);
  if(old?.hash===document.hash){event('unchanged','Referencia pública sin cambios',{url:source.url});return;}
  documents=documents.filter(d=>d.url!==document.url);documents.push(document);await write('documents.json',documents);
  event('document','Referencia pública incorporada a la memoria; contenido no verificado',{url:source.url,characters:document.text.length,role:'reference'});return;
 }
 let target=normalizeLearnableUrl(source.url),response;
 for(let redirects=0;redirects<=3;redirects++){
  response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'AtlasLocalResearch/1.0','Accept':'text/html,text/plain'}});
  if(response.status<300||response.status>=400)break;
  const location=response.headers.get('location');if(!location||redirects===3)throw Error('Redirección ausente o demasiado larga.');
  const next=normalizeLearnableUrl(new URL(location,target).href);if(new URL(next).hostname!==new URL(target).hostname)throw Error('Redirección fuera del dominio de documentación original.');target=next;
 }
 if(!response.ok)throw Error(`HTTP ${response.status}`);
 if(!/text\/(html|plain)/i.test(response.headers.get('content-type')||''))throw Error('No es un documento de texto.');
 if(!response.body)throw Error('Respuesta vacía.');
 let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>2_000_000)throw Error('Documento demasiado grande.');chunks.push(chunk);}
 const html=Buffer.concat(chunks).toString('utf8');
 const text=extractText(html).slice(0,config.maxDocumentCharacters);
 if(text.length<500)throw Error('Texto insuficiente o página de bloqueo.');
 const known=new Set([...config.sources,...state.discovered].map(s=>s.url));
 if((source.depth||0)<2)for(const url of discoverLinks(html,source.url)){
  if(known.size>=config.maxDocuments)break;
  if(!known.has(url)){state.discovered.push({url,role:'train',depth:(source.depth||0)+1});known.add(url);}
 }
 const digest=hash(text),old=documents.find(d=>d.url===source.url);
 if(old?.hash===digest){event('unchanged','Fuente sin cambios',{url:source.url});return;}
 if(documents.some(d=>d.hash===digest&&d.role!==source.role))throw Error('Duplicado entre grupos de datos.');
 documents=documents.filter(d=>d.url!==source.url);
 documents.push({url:source.url,role:source.role,text,hash:digest,fetchedAt:new Date().toISOString()});
 if(documents.length>config.maxDocuments)throw Error('Límite de documentos alcanzado.');
 await write('documents.json',documents);
 event('document','Documento incorporado; contenido externo no verificado',{url:source.url,characters:text.length,role:source.role});
}
async function cycle(){
 if(busy||closing||state.paused)return;
 if(autonomousBusy||mediaBusy){timer=setTimeout(cycle,60000);return;}
 busy=true;nextRun=null;
 try{
  // Bootstrap a reserve first. Each document keeps its role across all cycles.
  const ordered=[...config.sources.filter(s=>s.role==='validation'),...config.sources.filter(s=>s.role==='train'),...state.discovered];
  const source=fairSource(ordered);
  if(source){
   phase='Consultando documentación';state.checked[source.url]=Date.now();
   const domain=sourceHost(source),health=state.sourceHealth[domain]??={consecutiveFailures:0,lastAttempt:0};
   health.lastAttempt=Date.now();
   state.inFlightSource={url:source.url,domain,startedAt:new Date().toISOString()};await persist();
   try{
    await download(source);health.consecutiveFailures=0;health.lastSuccess=new Date().toISOString();health.retryAt=null;health.lastError=null;
   }catch(e){
    const diagnostic=describeFetchError(e);health.lastError=diagnostic.message;health.lastFailure=new Date().toISOString();
    event('fetch_error',diagnostic.message,{url:source.url,domain,code:diagnostic.code||undefined});
    if(isTransientFetchError(e,diagnostic.code)){
     health.consecutiveFailures=(health.consecutiveFailures||0)+1;
     if(health.consecutiveFailures>=3){
      const delay=Math.min(6*60*60*1000,15*60*1000*2**(health.consecutiveFailures-3));
      health.retryAt=new Date(Date.now()+delay).toISOString();
      event('domain_backoff',`${domain} aplazado ${Math.round(delay/60000)} min tras ${health.consecutiveFailures} fallos de red`,{domain,retryAt:health.retryAt});
     }
    }
   }finally{state.inFlightSource=null;}
  }else{
   const deferred=deferredSources();
   const refreshTimes=ordered.map(item=>(state.checked[item.url]||0)+config.refreshHours*3600000).filter(at=>at>Date.now());
   const wakeTimes=[...deferred.map(item=>Date.parse(item.retryAt)),...refreshTimes].filter(Number.isFinite).sort((a,b)=>a-b);
   phase=deferred.length?`Esperando recuperación de ${deferred[0].domain}`:'Fuentes revisadas; esperando renovación';
   idleUntil=wakeTimes[0]||null;
  }
  const experimentDocuments=trainingDocuments(documents);
  const signature=hash((config.trainingBackend==='cuda'?'cuda-spiral-v2-best-checkpoint\n':'parallel-spiral-v1\n')+experimentDocuments.map(d=>d.url+':'+d.hash+':'+d.role).sort().join('\n'));
  if(documents.some(d=>d.role==='train')&&documents.some(d=>d.role==='validation')&&!state.attempted.includes(signature)&&!state.paused&&!closing&&!mediaBusy){
   phase=config.trainingBackend==='cuda'?'Entrenando tres candidatos en GPU CUDA':`Comparando ${workerBudget(config.parallelCandidates||1)} candidatos en CPU`;
   const result=config.trainingBackend==='cuda'?await compareGpu(snapshot,experimentDocuments,config,()=>state.paused||closing):await compareCandidates(snapshot,experimentDocuments,config.stepsPerDocument,config.parallelCandidates||1,()=>state.paused||closing);
   state.attempted.push(signature);state.attempted=state.attempted.slice(-200);
   state.cycles++;state.lastMetrics=result.metrics;
   if(result.metrics.accepted){
    await write('previous-checkpoint.json',snapshot);
    await write('checkpoint.json',result.candidate);snapshot=result.candidate;state.accepted++;
   }else state.rejected++;
   foundationImages=await discoverFoundationImages(data);
   const record=spiralRecord({signature,documents,result,mandateHash,images:foundationImages});
   await write(`spiral-${record.id}.json`,record);
   state.spiral.unshift(record);state.spiral=state.spiral.slice(0,30);
   for(const candidate of result.metrics.candidates||[])if(candidate.error||!candidate.accepted){
    state.negativeLessons.unshift({at:record.at,experiment:record.id,signature,candidate:candidate.index,
     lesson:candidate.error||`Este candidato no mejoró la validación (${candidate.before} → ${candidate.after}).`,
     scope:'Resultado local; no regla universal'});
   }
   state.negativeLessons=state.negativeLessons.slice(0,200);
   event('training',result.metrics.accepted?'Candidato aceptado por validación local':'Candidato descartado; se conservan los pesos',result.metrics);
  }
  phase=state.paused?'Pausado':'Ciclo continuo · próxima fuente programada';
 }catch(e){phase='Incidencia registrada';event('error',e.message);}
 finally{busy=false;state.lastCycle=new Date().toISOString();await persist();schedule();}
}
function schedule(){
 clearTimeout(timer);if(closing||state.paused)return;
 const waiting=phase.startsWith('Esperando recuperación')||phase.startsWith('Fuentes revisadas; esperando');
 const delay=waiting&&Number.isFinite(idleUntil)?Math.max(1000,idleUntil-Date.now()):config.intervalSeconds*1000;
 nextRun=new Date(Date.now()+delay).toISOString();timer=setTimeout(cycle,delay);
}
function status(){const queued=[...new Set([...config.sources,...state.discovered].map(s=>s.url))],{events,spiral,negativeLessons,attempted,checked,discovered,sourceHealth,inFlightSource,...stateView}=state;return {serviceId:'atlas-local',chat:{model:chatModelName,engine:'llama.cpp CUDA',url:'/chat/',externalAgents:!!providerKey,weightTraining:false,weightAdapterActive:false,reflectionMemory:collaborations.length,adaptation:'Reflejos recuperables como contexto; pesos base de Qwen sin cambios',busy:chatBusy},origin:'Núcleo descargado de Atlas Sites v5',installation:'Motor local; no incluye servidor ni memoria privada de Sites',
 model:'MLP de caracteres propio, 5.638 parámetros',initialization:'Pesos locales nuevos; no se recuperaron los pesos privados de Sites',
 phase,active:!state.paused,busy,nextRun,pid:process.pid,device:config.trainingBackend==='cuda'?'CUDA configurada; consultar última ejecución':'CPU',tools:{web3d:'/studio/',gameTests:'/tools/test-game',unity:'Instalado; compilación pendiente por fallo de licencia/caché',codeGeneration:'Qwen local crea y repara funciones aisladas con contratos ejecutados'},unification:{inherited,foundation:{id:inherited.foundationId,promptCount:inherited.promptRefs.length,visualAssets:foundationImages.length,organigram:inherited.visualSeed.organigram},mandateHash,method:'Observar → comprender → conectar → aplicar → refutar → aprender',scope:'Semilla de prompts preservada; el organigrama visual queda pendiente de referencia del usuario; sin fusionar modelos ni memoria privada ausente'},
 configuration:{intervalSeconds:config.intervalSeconds,stepsPerDocument:config.stepsPerDocument,maxDocuments:config.maxDocuments,trainingBackend:config.trainingBackend||'cpu',gpuUpdates:config.gpuUpdates,parallelCandidates:workerBudget(config.parallelCandidates||1)},learning:{ingested:documents.length,capacity:config.maxDocuments,queued:queued.length,pending:queued.filter(url=>!documents.some(d=>d.url===url)).length,mode:'Consulta pública secuencial; referencias como contexto, candidatos experimentales evaluados aparte'},memoryBytes:process.memoryUsage().rss,documents:documents.map(({text,...d})=>({...d,characters:text.length})),
 ...stateView,sourceActivity:inFlightSource||null,sourceHealth:{deferredDomains:deferredSources(),failures:Object.entries(sourceHealth||{}).filter(([,v])=>v.consecutiveFailures).map(([domain,v])=>({domain,consecutiveFailures:v.consecutiveFailures,lastFailure:v.lastFailure,lastError:v.lastError,retryAt:v.retryAt}))},events:(events||[]).slice(0,30).map(({at,kind,message,url,domain,retryAt,code})=>({at,kind,message,url,domain,retryAt,code})),spiral:(spiral||[]).slice(0,3).map(({sourceHashes,...record})=>({...record,sourceCount:sourceHashes?.length||0})),negativeLessons:(negativeLessons||[]).slice(0,50),negativeLessonsCount:(negativeLessons||[]).length,attemptedCount:(attempted||[]).length,checkedCount:Object.keys(checked||{}).length,discoveredCount:(discovered||[]).length,checkpointSteps:snapshot.steps,limits:'Aprende patrones de caracteres. No acredita programación general, razonamiento ni generación hiperrealista. Validación reutilizada; sin evaluación ciega. No ejecuta instrucciones de fuentes. Sus herramientas aisladas evolucionan tras pruebas; servidor y pesos Qwen permanecen separados. No conecta cuentas ni API de pago.'};}
server=http.createServer(async(req,res)=>{
 const expected=`127.0.0.1:${config.port}`;
 const readOnly=req.method==='GET'||req.method==='HEAD';
 const localAlias=req.headers.host===`localhost:${config.port}`;
 if(req.headers.host!==expected&&!(readOnly&&localAlias)){res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});return res.end(`Abre Atlas desde http://${expected}/chat/ . Esta dirección no permite controlar el servicio local.`);}
 const url=new URL(req.url,`http://${expected}`);
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const pageAliases=new Set(['/chat','/games','/capabilities','/constellation','/research','/studio','/library','/project']);
 if(readOnly&&(localAlias||pageAliases.has(url.pathname))){
  const pathname=pageAliases.has(url.pathname)?url.pathname+'/':url.pathname;
  res.writeHead(308,{Location:`http://${expected}${pathname}${url.search}`});return res.end();
 }
 if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end((await fs.readFile(path.join(root,'index.html'),'utf8')).replace('__TOKEN__',token).replace('</head>','<link rel="stylesheet" href="/atlas-theme.css"></head>'));}
 if(req.method==='GET'&&url.pathname==='/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...status(),media:{busy:mediaBusy,progress:mediaProgress}}));}
 if(req.method==='GET'&&url.pathname==='/process/status'){
  res.setHeader('Content-Type','application/json');try{
   const core=await cognitiveCore.status(),lor=await lorLab.status(),evolution={...await qwenEvolution.status(),autonomy:await weightAutonomy.status()},agents=await codingCollaborators.status(),experience={...await experienceRuntime.status(),enabled:experienceEnabled,paused:state.paused};
   const experiencePhase={mind:'understand',ion:'apply',constellation:'connect',logic:'refute',retained:'retain',waiting:'observe'}[experience.phase]||'observe';
   const pendingTask=selectAutonomousTask(extensions,autonomy.history||[]);
   const learning=sanitizeLearningTelemetry({reviewEnabled:autonomy.enabled!==false,paused:state.paused,running:autonomousBusy,lastCycleAt:autonomy.history?.at(-1)?.at,nextRun:autonomy.nextRun,pendingTask:pendingTask?{taskId:pendingTask.id}:null,tools:extensions});
   const coding=[agents.aider,agents.smolagents,agents.native],agentCounters=coding.reduce((sum,item)=>({trials:sum.trials+item.attempts,accepted:sum.accepted+item.passed,rejected:sum.rejected+item.failed}),{trials:0,accepted:0,rejected:0});
   return res.end(JSON.stringify(sanitizeProcessTelemetry({at:new Date().toISOString(),core:{...core,version:core.activeId},lor:lor.last,evolution,agents,learning,experience,publicDocs:publicDocs.status(),processes:[
    {id:'chat',state:chatBusy?'running':mediaBusy?'waiting':'idle',phase:'understand'},
    {id:'research',state:libraryBusy||repositoryPerspectiveBusy?'running':state.paused?'waiting':'idle',phase:repositoryPerspectiveBusy?'connect':'observe',counters:{observations:documents.filter(document=>document.role==='reference').length}},
    {id:'tools',state:extensionBusy&&!coreReviewBusy&&(!autonomousBusy||!experienceEnabled||experience.phase==='ion')?'running':'idle',phase:'apply',counters:{trials:extensions.length,accepted:extensions.filter(item=>item.passed).length,rejected:extensions.filter(item=>!item.passed).length}},
    {id:'review',state:coreReviewBusy&&corePhase==='refute'||experience.running&&experience.phase==='logic'?'running':core.lastCycle?(core.lastCycle.accepted?'passed':'failed'):'idle',phase:'refute',counters:{trials:core.attempts,accepted:core.accepted,rejected:core.rejected}},
    {id:'core',state:coreReviewBusy?'running':state.paused?'waiting':'idle',phase:coreReviewBusy?corePhase:'retain',counters:{trials:core.attempts,accepted:core.accepted,rejected:core.rejected}},
    {id:'lor',state:lorBusy?'running':lor.last?(lor.last.verdict==='REFUTED'?'failed':'passed'):'idle',phase:lorBusy?'refute':'retain',counters:{trials:lor.last?1:0}},
    {id:'creative',state:creativeTask||experienceEnabled&&experience.running&&experience.phase==='ion'&&experience.objective?.kind==='creative-experiment'?'running':'waiting',phase:'apply'},
    {id:'video',state:gpuActivity==='video'?'running':'idle',phase:'apply'},
    {id:'weights',state:gpuActivity==='training'?'running':evolution.download?.status==='downloading'?'running':'waiting',phase:gpuActivity==='training'?'apply':'observe',counters:{trials:evolution.candidatesPrepared,accepted:0}},
    {id:'external',state:providerKey?'idle':'waiting',phase:'connect'},
    {id:'agents',state:coding.some(item=>item.busy)?'running':coding.some(item=>item.ready)?'idle':'waiting',phase:'apply',counters:agentCounters},
    {id:'experience',state:experienceEnabled&&!state.paused&&experience.running?'running':'waiting',phase:experiencePhase,counters:{trials:experience.experiences,accepted:experience.learningChanges}},
    {id:'suceso',state:experienceEnabled&&!state.paused&&experience.running&&experience.phase==='constellation'?'running':'waiting',phase:'connect'},
   ]})));
  }catch{res.writeHead(503);return res.end(JSON.stringify({error:'Telemetría no disponible.'}));}
 }
 if(req.method==='GET'&&url.pathname==='/experience/status'){
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...await experienceRuntime.status(),enabled:experienceEnabled,paused:state.paused,lab:await experienceRuntime.labStatus()}));
 }
 if(req.method==='POST'&&url.pathname==='/lor/experiment'){
  res.setHeader('Content-Type','application/json');if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  if(lorBusy){res.writeHead(429);return res.end(JSON.stringify({error:'El experimento LOR ya está en ejecución.'}));}
  lorBusy=true;const abort=new AbortController(),close=()=>{if(!res.writableEnded)abort.abort(Error('Experimento cancelado'));};res.on('close',close);
  try{return res.end(JSON.stringify(await lorLab.experiment({signal:abort.signal})));}catch(error){res.writeHead(400);return res.end(JSON.stringify({error:error.message}));}finally{lorBusy=false;res.off('close',close);}
 }
 if(req.method==='POST'&&url.pathname==='/core/propose'){
  res.setHeader('Content-Type','application/json');if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  if(coreReviewBusy||mediaBusy||chatBusy||busy||(extensionBusy&&!autonomousBusy)||closing){res.writeHead(429);return res.end(JSON.stringify({error:'Atlas está terminando otra tarea.'}));}
  if(autonomousBusy){autonomousAbort?.abort(Error('Revisión solicitada del núcleo'));await autonomousDone;}
  coreReviewBusy=true;extensionBusy=true;coreAbort=new AbortController();const signal=coreAbort.signal;
  const close=()=>{if(!res.writableEnded)coreAbort?.abort(Error('Propuesta cancelada'));};res.on('close',close);
  try{return res.end(JSON.stringify(await cognitiveCore.propose(generatePolicyCandidate,{signal,onStage:phase=>corePhase=phase})));}catch(error){res.writeHead(400);return res.end(JSON.stringify({error:error.message}));}finally{coreReviewBusy=false;extensionBusy=false;coreAbort=null;res.off('close',close);}
 }
 if(req.method==='GET'&&url.pathname==='/agents/status'){
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(await codingCollaborators.status()));
 }
 if(req.method==='POST'&&url.pathname==='/agents/benchmark'){
  res.setHeader('Content-Type','application/json');if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  if(coreReviewBusy||mediaBusy||chatBusy||busy||(extensionBusy&&!autonomousBusy)||closing){res.writeHead(429);return res.end(JSON.stringify({error:'Atlas está terminando otra tarea.'}));}
  if(autonomousBusy){autonomousAbort?.abort(Error('Prueba solicitada del colaborador'));await autonomousDone;}
  extensionBusy=true;coreAbort=new AbortController();const signal=coreAbort.signal,close=()=>{if(!res.writableEnded)coreAbort?.abort(Error('Prueba cancelada'));};res.on('close',close);
  try{
   const cases=[{input:{values:[1,2,1]},expected:[1,2]},{input:{values:['a','b','a']},expected:['a','b']},{input:{values:[]},expected:[]},{input:{values:[null,false,null,false]},expected:[null,false]},{input:{values:[1,'1',1,false,0,false]},expected:[1,'1',false,0]},{input:{},expected:[]},{input:null,expected:[]},{input:{values:'abc'},expected:[]}];
   const task='Recibe input={values:[primitivos JSON]} y devuelve el array sin valores repetidos, conservando el orden de la primera aparición. No confundas número 1 con texto "1", false con 0, ni null con otros valores. Si input o values no tienen el formato esperado devuelve []. No modifica la entrada.';
   const provider=url.searchParams.get('provider')==='smolagents'?'smolagents':'aider';
   const result=await codingCollaborators.build(task,chatKey,cases,(input)=>chat(input,[],fetch,chatKey,'',null,'',[],'',{signal,sharedSession:true,cognitiveCore}),{provider,format:'code',name:'Deduplicación estable · benchmark de agentes',curriculumTaskId:'stable-dedupe',signal});
   await write('agent-benchmark.json',result);return res.end(JSON.stringify({passed:result.passed,collaborator:result.collaborator,cases:result.acceptanceResults?.length,attempts:result.attempt,sourceReferences:result.sourceReferences||[],referenceErrors:result.referenceErrors||[],referenceContextProvided:result.referenceContextProvided===true}));
  }catch(error){res.writeHead(400);return res.end(JSON.stringify({error:error.message}));}finally{extensionBusy=false;coreAbort=null;res.off('close',close);}
 }
 if(req.method==='GET'&&url.pathname==='/media/status'){
  res.setHeader('Content-Type','application/json');try{return res.end(JSON.stringify({...await videoStatus(),busy:mediaBusy,gpuMode:gpuActivity||'chat',progress:mediaProgress}));}catch{res.writeHead(503);return res.end(JSON.stringify({ready:false,error:'No se pudo comprobar el motor de vídeo.'}));}
 }
 if(req.method==='GET'&&url.pathname==='/evolution/status'){
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...await qwenEvolution.status(),autonomy:await weightAutonomy.status()}));
 }
 if(req.method==='POST'&&url.pathname==='/evolution/yield'){
  res.setHeader('Content-Type','application/json');if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  const yielded=autonomousWeights;if(yielded){autonomousAbort?.abort(Error('Prioridad al chat pendiente'));mediaAbort?.abort(Error('Prioridad al chat pendiente'));}
  return res.end(JSON.stringify({yielded}));
 }
 if(req.method==='POST'&&url.pathname==='/evolution/train'){
  res.setHeader('Content-Type','application/json');if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  if(mediaBusy||chatBusy||busy||(extensionBusy&&!autonomousBusy)||closing){res.writeHead(429);return res.end(JSON.stringify({error:'La GPU está ocupada.'}));}
  mediaBusy=true;gpuActivity='training';mediaAbort=new AbortController();const signal=mediaAbort.signal;
  const close=()=>{if(!res.writableEnded)mediaAbort?.abort(Error('Experimento cancelado'));};res.on('close',close);
  let heartbeat;const send=value=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(value)+'\n');};
  const progress=(stage,value)=>{mediaProgress={stage,progress:Math.max(mediaProgress?.progress||0,Math.min(99,value))};send({type:'progress',...mediaProgress});};
  try{
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1000)throw Error('Petición demasiado grande.');chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'),preflight=await qwenEvolution.preflight();
   if(!preflight.experimentalProbePrepared)throw Error('El snapshot verificado o las dependencias de Qwen siguen pendientes.');
   if(autonomousBusy){autonomousAbort?.abort(Error('Prioridad al experimento de Qwen'));await autonomousDone;}signal.throwIfAborted();
   const candidate=input.id?{id:input.id}:await qwenEvolution.prepareCandidate();
   res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.flushHeaders();heartbeat=setInterval(()=>send({type:'heartbeat'}),12000);
   const result=await gpuLease.run(()=>qwenEvolution.trainCandidate(candidate.id,{signal,onProgress:event=>{if(event.type==='progress')progress(event.stage,event.progress);}}),{signal,role:'training',onStage:progress});
   await write('evolution-last-run.json',result);send({type:'result',...result});res.end();
  }catch(error){if(res.headersSent){send({type:'error',error:error.message});res.end();}else{res.writeHead(400);res.end(JSON.stringify({error:error.message}));}}
  finally{clearInterval(heartbeat);res.off('close',close);mediaBusy=false;gpuActivity=null;mediaAbort=null;mediaProgress=null;}
  return;
 }
 if(req.method==='GET'&&url.pathname==='/media/artifact'){
  const artifact=await resolveVideoArtifact(url.searchParams.get('id'));if(!artifact){res.writeHead(404);return res.end('Vídeo no disponible.');}
  res.writeHead(200,{'Content-Type':artifact.mime,'Content-Length':artifact.bytes.length});return res.end(artifact.bytes);
 }
 if(req.method==='POST'&&url.pathname==='/media/generate'){
  res.setHeader('Content-Type','application/json');
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  if(mediaBusy||chatBusy||busy||(extensionBusy&&!autonomousBusy)||closing){res.writeHead(429);return res.end(JSON.stringify({error:'La GPU está ocupada. El vídeo esperará a que termine la tarea actual.'}));}
  mediaBusy=true;gpuActivity='video';mediaAbort=new AbortController();const signal=mediaAbort.signal;
  const close=()=>{if(!res.writableEnded)mediaAbort?.abort(Error('Vídeo cancelado por el usuario'));};res.on('close',close);
  let heartbeat;const send=value=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(value)+'\n');};
  const progress=(stage,percent)=>{mediaProgress={stage,progress:Math.max(mediaProgress?.progress||0,Math.min(99,percent))};send({type:'progress',...mediaProgress});};
  try{
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>6000)throw Error('Descripción demasiado grande.');chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8')),options=videoOptions(input.parameters||input.options||{});
   if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>2000)throw Error('Describe el vídeo con entre 1 y 2000 caracteres.');
   if(!(await videoStatus()).ready)throw Error('Modelos o dependencias de vídeo pendientes.');
   if(autonomousBusy){autonomousAbort?.abort(Error('Prioridad al vídeo solicitado'));await autonomousDone;}signal.throwIfAborted();
   res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.flushHeaders();heartbeat=setInterval(()=>send({type:'heartbeat'}),12000);
   const result=await gpuLease.run(async()=>{await startVideoRuntime();signal.throwIfAborted();return generateVideo(input.prompt,{...options,signal,onProgress:event=>progress(event.stage==='loading'?'video':event.stage,event.stage==='sampling'?5+85*(event.value/(event.max||options.steps)):event.stage==='encoding'?94:event.stage==='completed'?97:3)});},{signal,onStage:progress});
   send({type:'result',...result});res.end();
  }catch(error){if(res.headersSent){send({type:'error',error:error.message});res.end();}else{res.writeHead(400);res.end(JSON.stringify({error:error.message}));}}
  finally{clearInterval(heartbeat);res.off('close',close);mediaAbort=null;mediaBusy=false;gpuActivity=null;mediaProgress=null;}
  return;
 }
 if(req.method==='GET'&&url.pathname==='/atlas-theme.css'){res.setHeader('Content-Type','text/css; charset=utf-8');return res.end(await fs.readFile(path.join(root,'atlas-theme.css'),'utf8'));}
 if(req.method==='GET'&&url.pathname==='/project/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(sitePage((await fs.readFile(path.join(root,'unified-project.html'),'utf8')).replace('__TOKEN__',token)));}
 if(req.method==='GET'&&url.pathname==='/project/status'){
  res.setHeader('Content-Type','application/json');try{return res.end(JSON.stringify(await currentProjectStatus()));}catch(error){res.writeHead(503);return res.end(JSON.stringify({error:error.message}));}
 }
 if(req.method==='GET'&&url.pathname.startsWith('/project/artifacts/')){
  try{
   const artifact=await resolveSecondaryArtifact(url.pathname.slice('/project/artifacts/'.length));
   res.setHeader('Content-Type',artifact.mime);res.setHeader('Content-Security-Policy',"sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
   return res.end(artifact.bytes??await fs.readFile(artifact.path));
  }catch{res.writeHead(404);return res.end('Artefacto local no disponible.');}
 }
 if(req.method==='POST'&&url.pathname==='/project/action'){
  res.setHeader('Content-Type','application/json');
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  const abort=new AbortController(),onClose=()=>{if(!res.writableEnded)abort.abort(Error('Petición cancelada'));};res.on('close',onClose);
  try{
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12000)throw Error('Petición demasiado grande.');chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   creativeTask=input.sharedSession===true&&input.json===true&&['world','game'].includes(input.creativeMode)?input.creativeMode:null;
   if(!['decision','game','train','stop'].includes(input.action))throw Error('Acción desconocida.');
   if(input.action==='train'&&(state.paused||chatBusy||extensionBusy||mediaBusy))throw Error('Espera a que Atlas termine su tarea o reanuda el coordinador.');
   const payload=input.input&&typeof input.input==='object'&&!Array.isArray(input.input)?input.input:{};
   if(input.action==='decision')payload.question=payload.question??payload.text;
   const result=await runSecondary(input.action,payload,{signal:abort.signal});return res.end(JSON.stringify(result));
  }catch(error){if(!res.destroyed){res.writeHead(400);return res.end(JSON.stringify({error:error.message}));}}
  finally{res.off('close',onClose);}
  return;
 }
 if(req.method==='GET'&&url.pathname==='/library/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(sitePage(await fs.readFile(path.join(root,'repo-library.html'),'utf8')));}
 if(req.method==='GET'&&url.pathname==='/library/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(currentLibraryStatus()));}
 if(req.method==='GET'&&url.pathname==='/library/taxonomy'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(loadRepositoryTaxonomy()));}
 if(req.method==='GET'&&url.pathname==='/library/notes'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({total:repositoryNotes.length,items:repositoryNotes.slice(-10).reverse()}));}
 if(req.method==='GET'&&url.pathname==='/library/items'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(combinedLibraryItems({query:url.searchParams.get('q')||'',limit:url.searchParams.get('limit')||30,offset:url.searchParams.get('offset')||0})));}
 if(req.method==='POST'&&url.pathname==='/autonomy/run'){
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end();}
  if(state.paused||autonomousBusy||chatBusy||mediaBusy){res.writeHead(409);return res.end(JSON.stringify({error:'Atlas está pausado u ocupado.'}));}
  clearTimeout(autonomousTimer);autonomy.nextRun=null;await write('autonomous-review.json',autonomy);void autonomousReview();res.writeHead(202,{'Content-Type':'application/json'});return res.end(JSON.stringify({queued:true}));
 }
 if(req.method==='GET'&&url.pathname==='/games/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(sitePage((await fs.readFile(path.join(root,'games.html'),'utf8')).replace('__TOKEN__',token)));
 }
 if(req.method==='GET'&&url.pathname==='/games/catalog'){
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(gameReferences));
 }
 if(req.method==='GET'&&url.pathname==='/games/media'){
  try{const picture=await readGameImage(gameReferences,url.searchParams.get('path'));res.setHeader('Content-Type',picture.mime);res.setHeader('Cross-Origin-Resource-Policy','same-origin');return res.end(picture.bytes);}
  catch(e){res.writeHead(404);return res.end('Imagen no disponible');}
 }
 if(req.method==='POST'&&url.pathname==='/games/refresh'){
  res.setHeader('Content-Type','application/json');
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  if(gameRefreshBusy){res.writeHead(409);return res.end(JSON.stringify({error:'Lectura de biblioteca en curso'}));}
  gameRefreshBusy=true;
  try{gameReferences=await gameLibrary();await write('game-library.json',gameReferences);return res.end(JSON.stringify(gameReferences));}
  catch(e){res.writeHead(503);return res.end(JSON.stringify({error:'No se puede leer la biblioteca local de juegos: '+(e.code||e.message)}));}
  finally{gameRefreshBusy=false;}
 }
 if(req.method==='GET'&&url.pathname==='/constellation/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(sitePage(await fs.readFile(path.join(root,'constellation.html'),'utf8')));
 }
 if(req.method==='GET'&&url.pathname==='/constellation/state'){
  res.setHeader('Content-Type','application/json');let catalog={models:[],at:null},catalogError=null;
  try{catalog=await starCatalog();}catch(e){catalogError=e.message;}
  let localReady=false;try{localReady=(await fetch('http://127.0.0.1:11435/health',{signal:AbortSignal.timeout(2000)})).ok;}catch{}
  return res.end(JSON.stringify({catalog,catalogError,localReady,externalConfigured:!!providerKey,extensions,toolRuns:(await read('tool-runs.json',[])).slice(-8),reflections:collaborations.slice(-20)}));
 }
 if(req.method==='GET'&&url.pathname==='/capabilities/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(sitePage((await fs.readFile(path.join(root,'capabilities.html'),'utf8')).replace('__TOKEN__',token)));
 }
 if(req.method==='GET'&&url.pathname==='/capabilities/status'){
  const latest=autonomy.history?.at(-1);
  const autonomousReview={enabled:autonomy.enabled!==false,programmingEnabled:config.autonomousProgramming!==false,paused:state.paused,running:autonomousBusy,nextRun:autonomy.nextRun,waitReason:autonomy.waitReason||null,lastError:autonomy.lastError||null,reports:autonomy.history?.length||0,last:latest?{at:latest.at,checks:latest.checks,curriculum:latest.curriculum,assessment:latest.assessment,assessmentStatus:latest.assessmentStatus,candidate:latest.candidate?{id:latest.candidate.id,name:latest.candidate.name,taskId:latest.candidate.curriculumTaskId,passed:latest.candidate.passed}:null}:null};
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({openrouterConfigured:!!providerKey,route:'openrouter/free',usage:state.providerUsage,extensions,extensionBusy,autonomousReview,unifiedProject:'/project/'}));
 }
 if(req.method==='POST'&&['/capabilities/connect','/capabilities/build','/capabilities/run'].includes(url.pathname)){
  res.setHeader('Content-Type','application/json');
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  let ownsBuild=false;
  try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>60000)throw Error('Petición demasiado grande');chunks.push(c);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(url.pathname==='/capabilities/connect'){
    if(typeof input.key!=='string'||!/^sk-or-[A-Za-z0-9_-]{20,500}$/.test(input.key))throw Error('Formato de clave OpenRouter inválido.');
    const check=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+input.key},signal:AbortSignal.timeout(15000)});
    if(!check.ok)throw Error('OpenRouter no ha validado la clave. No se ha guardado.');
    await fs.writeFile(providerKeyPath,input.key,{mode:0o600});providerKey=input.key;return res.end(JSON.stringify({configured:true,route:'openrouter/free'}));
   }
   if(url.pathname==='/capabilities/build'){
    if(extensionBusy||chatBusy||mediaBusy)throw Error('Atlas está ocupado. Espera a que termine.');extensionBusy=true;ownsBuild=true;
    const previous=input.parentId?extensions.find(x=>x.id===input.parentId):null;
    if(input.parentId&&!previous)throw Error('No existe la versión de partida.');
    const record=previous?await improveExtension(previous,input.task,chatKey,input.acceptanceTests??[]):await buildExtension(input.task,chatKey,input.acceptanceTests??[]);
    if(previous)await retainContract(record,previous);
    extensions.push(record);await write('extensions.json',extensions);return res.end(JSON.stringify(record));
   }
   const record=extensions.find(x=>x.id===input.id);if(!record?.passed)throw Error('La extensión no existe o no superó sus pruebas');
   const result=await executePure(record.source,input.input);return res.end(JSON.stringify({result,scope:'Ejecutado en QuickJS sin archivos ni red'}));
  }catch(e){res.writeHead(400);return res.end(JSON.stringify({error:e.message}));}finally{if(ownsBuild)extensionBusy=false;}
 }
 if(req.method==='GET'&&url.pathname==='/chat/ui.css'){
  res.setHeader('Content-Type','text/css; charset=utf-8');return res.end(await fs.readFile(path.join(root,'chat-ui.css'),'utf8'));
 }
 if(req.method==='GET'&&url.pathname==='/chat/history.mjs'){
  res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(await fs.readFile(path.join(root,'chat-history.mjs'),'utf8'));
 }
 if(req.method==='GET'&&url.pathname==='/chat/response-stream.mjs'){
  res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(await fs.readFile(path.join(root,'chat-response-stream.mjs'),'utf8'));
 }
 if(req.method==='GET'&&url.pathname==='/chat/pages.css'){
  res.setHeader('Content-Type','text/css; charset=utf-8');return res.end(await fs.readFile(path.join(root,'pages-ui.css'),'utf8'));
 }
 if(req.method==='GET'&&url.pathname==='/chat/pages.js'){
  res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(await fs.readFile(path.join(root,'pages-ui.js'),'utf8'));
 }
 if(req.method==='GET'&&url.pathname==='/chat/ui.js'){
  res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(await fs.readFile(path.join(root,'chat-ui.js'),'utf8'));
 }
 if(req.method==='GET'&&url.pathname==='/chat/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end((await fs.readFile(path.join(root,'chat.html'),'utf8')).replace('__TOKEN__',token));
 }
 if(req.method==='GET'&&url.pathname==='/chat/health'){
  res.setHeader('Content-Type','application/json');
  try{const r=await fetch('http://127.0.0.1:11435/health',{signal:AbortSignal.timeout(2000)});return res.end(JSON.stringify({ready:r.ok,model:'atlas-local',modelName:chatModelName,gpu:'GPU local · backend configurado',externalAgents:!!providerKey,reflectionMemory:collaborations.length,weightAdapterActive:false,webSearchEngine:'duckduckgo-lite',webSearchProviders:['Google','DuckDuckGo Lite','Wikipedia'],googleSearch:googleSearchStatus()}));}
  catch{return res.end(JSON.stringify({ready:false,externalAgents:!!providerKey}));}
 }
 if(req.method==='POST'&&url.pathname==='/learn/source'){
  res.setHeader('Content-Type','application/json');
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  try{
   let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>4000)throw Error('Petición demasiado grande.');chunks.push(c);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const descriptor=sourceDescriptor(input.url),sourceUrl=descriptor.url;
   if(documents.some(d=>d.url===sourceUrl))return res.end(JSON.stringify({queued:false,alreadyIngested:true,url:sourceUrl,message:'Esta fuente ya está en la memoria local.'}));
   const known=[...config.sources,...state.discovered].some(s=>s.url===sourceUrl);
   if(!known){const count=new Set([...config.sources,...state.discovered].map(s=>s.url)).size;if(count>=(config.maxQueuedSources||config.maxDocuments))throw Error('Se alcanzó la capacidad de la cola local.');state.discovered.unshift(descriptor);}
   delete state.checked[sourceUrl];event('source',known?'Fuente oficial puesta de nuevo en cola':'Nueva fuente oficial añadida a la cola',{url:sourceUrl});await persist();
   return res.end(JSON.stringify({queued:true,url:sourceUrl,role:descriptor.role,message:'Fuente añadida a la cola persistente de consulta y memoria.'}));
  }catch(e){res.writeHead(400);return res.end(JSON.stringify({error:e.message}));}
 }
 if(req.method==='POST'&&url.pathname==='/chat/message'){
  res.setHeader('Content-Type','application/json');
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
  if(mediaBusy&&autonomousWeights){autonomousAbort?.abort(Error('Prioridad al chat'));mediaAbort?.abort(Error('Prioridad al chat'));await mediaDone;}
  if(chatBusy||mediaBusy||(extensionBusy&&!autonomousBusy)){res.writeHead(429);return res.end(JSON.stringify({error:mediaBusy?'La GPU está generando vídeo. Qwen volverá al terminar.':'Atlas ya está respondiendo o creando una herramienta. Espera a que termine.'}));}
  chatBusy=true;
  const requestAbort=new AbortController();
  const closeRequest=()=>{if(!res.writableEnded)requestAbort.abort(Error('Petición cancelada por el usuario'));};
  res.on('close',closeRequest);
  let streaming=false,heartbeat;
  const sendEvent=event=>{if(streaming&&!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(event)+'\n');};
  try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>220000)throw Error('Petición demasiado grande');chunks.push(c);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const messages=validateMessages(input.messages);validateAttachments(input.attachments);
   if(input.internet===true&&input.sharedSession!==true){
    let added=0;for(const link of extractUserSourceUrls(messages.at(-1).content)){
     if([...config.sources,...state.discovered].some(source=>source.url===link))continue;
     if(new Set([...config.sources,...state.discovered].map(source=>source.url)).size>=(config.maxQueuedSources||config.maxDocuments))break;
     state.discovered.push(sourceDescriptor(link));added++;
    }
    if(added){event('source',`${added} enlace(s) del chat añadidos a la memoria documental persistente`);await persist();}
   }
   requestAbort.signal.throwIfAborted();
   streaming=(req.headers.accept||'').includes('application/x-ndjson');
   if(streaming){res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.flushHeaders();heartbeat=setInterval(()=>sendEvent({type:'heartbeat'}),15000);}
   if(autonomousBusy){autonomousAbort?.abort(Error('Prioridad al mensaje del usuario'));await autonomousDone;}
   if(input.sharedSession===true){
    if(projectCommand(messages.at(-1).content))throw Error('Los controles del PC solo están disponibles en la interfaz local.');
    const available=publicTools(extensions),requested=publicToolIntent(messages.at(-1).content);let publicToolRun=null;
    if(requested&&available.length)publicToolRun=await useExtension(messages,available,chatKey,spec=>chat(spec,[],fetch,chatKey,'',null,'',[],'',{signal:requestAbort.signal,sharedSession:true,cognitiveCore}));
    const result=await chat({...input,tools:false,external:false,attachments:[]},[],fetch,chatKey,'',publicToolRun,'',[],'',{cognitiveCore,lookupEvidence:atlasEvidence,sharedSession:true,signal:requestAbort.signal,onEvent:streaming?sendEvent:undefined,capabilities:{...atlasApplicationCapabilities({sharedSession:true,experience:{...await experienceRuntime.status(),enabled:experienceEnabled,paused:state.paused},agents:await codingCollaborators.status(),video:await videoStatus().catch(()=>({ready:false})),publicDocs:publicDocs.status()}),localModel:chatModelName,sharedSession:true,internet:{available:true,requested:input.internet===true},tools:{available:available.length,requested,scope:'Solo funciones públicas de currículo canónico, contratos ejecutados y QuickJS aislado.'},externalModels:{configured:false},selfModification:{strategyPolicy:true,weightCandidates:true,serverCode:false,qwenWeights:false,scope:"Herramientas y políticas evolucionan con contratos; LoRA permanece candidata hasta validación."},privateMemory:false}});
    if(streaming){sendEvent({type:'result',result});return res.end();}return res.end(JSON.stringify(result));
   }
   const command=projectCommand(messages.at(-1).content);
   if(command){
    if(command.action==='train'&&state.paused)throw Error('El coordinador está pausado. Reanúdalo antes de entrenar el laboratorio.');
    sendEvent({type:'stage',stage:'tools'});
    const result=await answerProjectCommand(command,{run:runSecondary,status:currentProjectStatus,origin:`http://${expected}`,signal:requestAbort.signal});
    if(streaming){sendEvent({type:'result',result});return res.end();}return res.end(JSON.stringify(result));
   }
   if(input.external===true&&providerKey){const day=new Date().toISOString().slice(0,10);if(state.providerUsage?.day!==day)state.providerUsage={day,count:0};if(state.providerUsage.count>=20)throw Error('Límite local de 20 colaboraciones gratuitas al día alcanzado. Desactiva el colaborador para seguir en local.');state.providerUsage.count++;await persist();}
   if(input.tools===true)sendEvent({type:'stage',stage:'tools'});
   const toolRun=input.tools===true?await useExtension(messages,extensions,chatKey,(request,docs,fetcher,key)=>chat(request,docs,fetcher,key,'',null,'',[],'',{signal:requestAbort.signal})):null;
   requestAbort.signal.throwIfAborted();
   if(toolRun){const runs=await read('tool-runs.json',[]);runs.push(toolRun);await write('tool-runs.json',runs.slice(-50));}
   const gameContext=gameLibraryContext(gameReferences,messages.at(-1).content);
   const capabilities={...atlasApplicationCapabilities({experience:{...await experienceRuntime.status(),enabled:experienceEnabled,paused:state.paused},agents:await codingCollaborators.status(),video:await videoStatus().catch(()=>({ready:false})),publicDocs:publicDocs.status()}),localModel:chatModelName,internet:{available:true,requested:input.internet===true,connectivity:'Solo comprobada mediante las fuentes o errores de este turno'},tools:{available:extensions.filter(e=>e.passed).length,requested:input.tools===true,scope:'Funciones aisladas QuickJS'},localCouncil:{available:true,automatic:true,independentModels:false},autonomousReview:{enabled:autonomy.enabled!==false,paused:state.paused,completed:autonomy.history?.length||0,nextRun:autonomy.nextRun},externalModels:{configured:!!providerKey,requested:input.external===true},selfModification:{toolCandidates:true,strategyPolicy:true,weightCandidates:true,serverCode:false,qwenWeights:false,scope:"Los candidatos LoRA se entrenan aparte; Qwen activo conserva sus pesos base."}};
   capabilities.repositoryLibrary={...librarySummary().counts,reflections:repositoryNotes.length};
   capabilities.integratedLab={available:(await secondaryStatus()).available,route:'/project/',commands:['/atlas estado','/prototipo <idea>','/laboratorio <pregunta>','/atlas aprender','/atlas parar'],scope:'Laboratorio CPU del modelo pequeño de decisiones y prototipos Canvas 2D por reglas; no cambia Qwen'};
   let importedMemory=[];try{importedMemory=await searchSecondaryMemory(memoryQuery(messages.at(-1).content));}catch(error){event('imported_memory_error',error.message);}
   const result=await chat(input,documents,fetch,chatKey,providerKey,toolRun,mandate,collaborations,gameContext,{cognitiveCore,lookupEvidence:atlasEvidence,capabilities,importedMemory,repositoryNotes:matchingRepositoryNotes(messages.at(-1).content),signal:requestAbort.signal,onEvent:streaming?sendEvent:undefined});
   if(result.collaborators?.length){collaborations.push(...result.collaborators.map(peer=>({at:new Date().toISOString(),model:peer.model,question:messages.at(-1).content,critique:peer.text,answer:result.answer,status:'spiral-reviewed-unverified',reviewedBy:'Qwen local second pass',trained:false,weightUpdate:false})));collaborations=collaborations.slice(-100);await write('collaborations.json',collaborations);}
   if(streaming){sendEvent({type:'result',result});return res.end();}
   return res.end(JSON.stringify(result));
  }catch(e){
   if(res.destroyed)return;
   if(streaming){sendEvent({type:'error',error:e.message});return res.end();}
   res.writeHead(400);return res.end(JSON.stringify({error:e.message}));
  }finally{clearInterval(heartbeat);res.off('close',closeRequest);chatBusy=false;creativeTask=null;}
 }
 if(req.method==='GET'&&url.pathname==='/research/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(sitePage((await fs.readFile(path.join(root,'research.html'),'utf8')).replace('__TOKEN__',token)));
 }
 if(url.pathname==='/research/claims'){
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET')return res.end(JSON.stringify(claims));
  if(req.method==='POST'){
   if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end(JSON.stringify({error:'Origen no autorizado'}));}
   try{
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>100000){res.writeHead(413);return res.end(JSON.stringify({error:'Registro demasiado grande'}));}chunks.push(chunk);}
    if(claims.length>=1000)throw Error('Memoria llena: conserva o revisa los registros antes de añadir más.');
    const claim=makeClaim(JSON.parse(Buffer.concat(chunks).toString('utf8')));claims.push(claim);await write('claims.json',claims);
    res.writeHead(201);return res.end(JSON.stringify(claim));
   }catch(e){res.writeHead(400);return res.end(JSON.stringify({error:e.message}));}
  }
 }
 if(req.method==='GET'&&url.pathname==='/mandate'){res.setHeader('Content-Type','text/plain; charset=utf-8');return res.end(mandate);}
 const studioFiles={'/studio/':'studio/index.html','/studio/game.mjs':'studio/game.mjs','/studio/logic.mjs':'studio/logic.mjs','/studio/vendor/three.module.js':'studio/vendor/three.module.js','/studio/vendor/three.core.js':'studio/vendor/three.core.js'};
 if(req.method==='GET'&&Object.hasOwn(studioFiles,url.pathname)){
  res.setHeader('Content-Type',url.pathname==='/studio/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
  try{return res.end(await fs.readFile(path.join(root,studioFiles[url.pathname])));}catch{res.writeHead(500);return res.end('No se pudo cargar el taller');}
 }
 if(req.method==='POST'&&url.pathname==='/tools/test-game'){
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end();}
  const result=await testGame();await write('game-tests.json',result);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
 }
 if(req.method==='GET'&&url.pathname==='/search'){
  const query=(url.searchParams.get('q')||'').slice(0,500);
  res.setHeader('Content-Type','application/json');
  return res.end(JSON.stringify({query,method:'Búsqueda textual local con procedencia; no respuesta generada por el modelo.',results:searchDocuments(documents,query)}));
 }
 if(req.method==='POST'&&['/pause','/resume','/stop'].includes(url.pathname)){
  if(req.headers['x-atlas-token']!==token||req.headers.origin!==`http://${expected}`){res.writeHead(403);return res.end();}
  state.paused=url.pathname!=='/resume';phase=state.paused?'Pausado':'Preparado';clearTimeout(timer);
  if(state.paused)mediaAbort?.abort(Error('Proceso detenido por el usuario'));
  if(state.paused)coreAbort?.abort(Error('Proceso detenido por el usuario'));
  if(state.paused)autonomousAbort?.abort(Error('Proceso detenido por el usuario'));
  if(state.paused)await runSecondary('stop').catch(error=>event('lab_stop_error',error.message));
  if(url.pathname==='/stop')await fs.writeFile(path.join(data,'service.stop'),new Date().toISOString());
  else if(url.pathname==='/resume')await fs.rm(path.join(data,'service.stop'),{force:true});
  await persist();res.end('OK');
  if(url.pathname==='/stop')return shutdown();
  if(!state.paused)cycle();return;
 }
 res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas · Página no encontrada</title><body style="font:18px system-ui;background:#f4f5ef;color:#293b2b;padding:8vw"><h1>Atlas está en marcha</h1><p>Esta página no existe.</p><a href="/chat/">Abrir el chat de Atlas</a></body></html>');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,'127.0.0.1',resolve);});
await fs.writeFile(path.join(data,'service.pid'),String(process.pid));
event('start',`Coordinador iniciado; entrenador configurado: ${config.trainingBackend||'CPU'}. No representa una instalación completa del servidor de Sites.`);
await persist();console.log(`Atlas local: http://127.0.0.1:${config.port}`);
cycle();
autonomousTimer=setTimeout(autonomousReview,20000);
libraryTimer=setTimeout(libraryCycle,10000);
async function shutdown(){
 closing=true;clearTimeout(timer);clearTimeout(autonomousTimer);clearTimeout(libraryTimer);server.close();
 libraryAbort?.abort(Error('Reinicio del coordinador'));
 autonomousAbort?.abort(Error('Reinicio del coordinador'));
 mediaAbort?.abort(Error('Reinicio del coordinador'));
 coreAbort?.abort(Error('Reinicio del coordinador'));
 await runSecondary('stop').catch(()=>{});
 while(busy||autonomousBusy||chatBusy||extensionBusy||libraryBusy||mediaBusy)await new Promise(r=>setTimeout(r,100));
 await persist();await fs.rm(path.join(data,'service.pid'),{force:true});process.exit(0);
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
