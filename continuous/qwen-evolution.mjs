// Weight-adaptation staging. This module never changes the live GGUF or starts
// another server. Training requires the coordinator's live, exclusive GPU lease.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {getAutonomousTask} from './autonomy-curriculum.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT=process.env.ATLAS_EVOLUTION_ROOT||path.join(HERE,'data','evolution');
export const QWEN_EVOLUTION_MODEL=Object.freeze({id:'Qwen/Qwen3.5-9B',revision:'c202236235762e1c871ad0ccb60c8ee5ba337b9a',architecture:'Qwen3_5ForConditionalGeneration',license:'Apache-2.0',sourceWeightBytes:19306216416});
const ID=/^qw-[a-f0-9]{32}$/;
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2);
const TOOL_INSTRUCTIONS=Object.freeze({
 'stable-dedupe':'Deduplica values conservando primera aparición y tipos. Objetos/listas dentro de values o values inválido: {"error":"invalid_values"}. Solo JSON exacto. Entrada: ',
 'numeric-statistics':'Estadísticas JSON de values: count,sum,min,max,mean,median (orden numérico). Inválido: {"error":"invalid_numbers"}. Entrada: ',
 'merge-intervals':'Normaliza, ordena y fusiona intervals cerrados que se toquen o solapen. Inválido: {"error":"invalid_intervals"}. Devuelve solo JSON {"intervals":[...]}. Entrada: ',
});

// These are generated labels with independently computable answers. Arbitrary
// chats, repository text and a model's assertion of correctness are not accepted.
export function evolutionCorpus({trainCount=32,holdoutCount=8}={}){
 if(!Number.isInteger(trainCount)||trainCount<8||trainCount>128||!Number.isInteger(holdoutCount)||holdoutCount<4||holdoutCount>32)throw Error('Presupuesto de ejemplos fuera de límites.');
 const symbols=[['O','objetos'],['A','ambiente'],['X','estados'],['R','relaciones'],['T','transformaciones'],['I','invariantes'],['C','restricciones'],['E','escala'],['M','medida'],['P','predicciones'],['F','falsadores'],['Σ','cadena semiótica']];
 const make=(count,offset,split)=>Array.from({length:count},(_,i)=>{
  const index=i+offset,family=i%2?'lor-symbol':'integer-arithmetic';let prompt,answer;
  if(family==='integer-arithmetic'){const a=11+index*7,b=3+index%13;prompt=split==='train'?`Devuelve solo JSON {"resultado":numero}: ${a} por ${b}.`:`Calcula ${a} × ${b}. Responde exclusivamente con JSON y la clave resultado.`;answer={resultado:a*b};}
  else{const pair=symbols[Math.floor(i/2)%symbols.length];prompt=split==='train'?`En LOR-ΩΣ original, ¿qué significa ${pair[0]}? Solo JSON {"simbolo":"...","significado":"..."}.`:`Traduce el campo ${pair[0]} de S* LOR-ΩΣ a JSON exacto con simbolo y significado.`;answer={simbolo:pair[0],significado:pair[1]};}
  const content={family,prompt,answer};return {id:sha(json(content)),...content,split,provenance:{origin:'atlas-formal-fixtures-v1',verification:'deterministic-label',privateHistory:false}};
 });
 const train=make(trainCount,0,'train'),holdout=make(holdoutCount,1000,'holdout');
 const regression=[{family:'unseen-regression',prompt:'Responde solo JSON {"pesoQwenCambiado":false} si este ensayo todavía no ha publicado un adaptador en el chat.',answer:{pesoQwenCambiado:false}},{family:'unseen-regression',prompt:'Solo JSON. Si una afirmación no tiene una prueba, usa {"estado":"no demostrado"}.',answer:{estado:'no demostrado'}}].map(value=>({id:sha(json(value)),...value,split:'regression',provenance:{origin:'atlas-formal-fixtures-v1',verification:'deterministic-label',privateHistory:false}}));
 return {version:1,train,holdout,regression,scope:'Muestras sintéticas separadas y dos regresiones de una familia no entrenada; no es un benchmark general ni prueba de aprendizaje del mundo.'};
}
export function validateEvolutionJob(value){
 if(!value||value.version!==1||!ID.test(value.id)||value.model?.id!==QWEN_EVOLUTION_MODEL.id||value.model?.revision!==QWEN_EVOLUTION_MODEL.revision)throw Error('Experimento de Qwen no válido.');
 if(value.profile!=='qlora-experimental'||value.rank!==4||value.maxSequenceLength!==128||value.steps!==8||value.learningRate!==0.00001)throw Error('El experimento excede la receta revisada.');
 if(typeof value.corpusSha256!=='string'||! /^[a-f0-9]{64}$/.test(value.corpusSha256))throw Error('Falta la identidad del corpus.');
 if(typeof value.runnerSha256!=='string'||! /^[a-f0-9]{64}$/.test(value.runnerSha256))throw Error('Falta la identidad del entrenador.');
 return {version:1,id:value.id,model:{...QWEN_EVOLUTION_MODEL},profile:value.profile,rank:4,maxSequenceLength:128,steps:8,learningRate:0.00001,corpusSha256:value.corpusSha256,runnerSha256:value.runnerSha256};
}
export function candidateGate(report){
 const valid=part=>part&&Number.isInteger(part.correct)&&Number.isInteger(part.total)&&part.total>=4&&part.correct>=0&&part.correct<=part.total;
 const baseline=report?.baseline?.holdout,candidate=report?.candidate?.holdout,regBefore=report?.baseline?.regression,regAfter=report?.candidate?.regression;
 const validRegression=part=>part&&Number.isInteger(part.total)&&part.total>=2&&Number.isInteger(part.correct)&&part.correct>=0&&part.correct<=part.total;
 const measured=valid(baseline)&&valid(candidate)&&baseline.total===candidate.total&&validRegression(regBefore)&&validRegression(regAfter)&&regBefore.total===regAfter.total;
 return {measured:!!measured,improvedOnSyntheticHoldout:!!measured&&candidate.correct>baseline.correct&&regAfter.correct>=regBefore.correct,canActivate:false,reason:'Se requiere conversión del adaptador y comparación nativa GGUF contra la versión activa, además de estas pruebas sintéticas.'};
}
async function run(executable,args,{signal,onEvent=()=>{},env={},timeout=1800000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe'],env:{...process.env,...env}});let output='',errors='',settled=false,abortReason=null,lastError='';
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  // Windows venv python.exe is a launcher and may own a real Python child.
  // Stop only this newly spawned process tree, then await pipe/process close.
  const killOwned=()=>{if(process.platform==='win32'&&Number.isInteger(child.pid))execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill();};
  const abort=()=>{abortReason=signal?.reason||Error('Entrenamiento cancelado.');killOwned();};
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1000000){abortReason=Error('Salida de entrenamiento demasiado grande.');killOwned();return;}let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end);output=output.slice(end+1);try{const event=JSON.parse(line);if(event.type==='error')lastError=String(event.error||'Error del candidato').slice(0,1000);onEvent(event);if(event.type==='result')child.result=event.result;}catch{}}});
  child.stderr.on('data',chunk=>errors=(errors+chunk).slice(-1600));child.once('error',error=>finish(error));child.once('close',code=>abortReason?finish(abortReason):code===0&&child.result?finish(null,child.result):finish(Error('El experimento terminó sin resultado válido: '+(lastError||errors.slice(-400)))));
  const timer=setTimeout(()=>{abortReason=Error('Tiempo máximo de experimento agotado.');killOwned();},timeout);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 });
}
export function createQwenEvolution({root=DEFAULT_ROOT,python=path.join(root,'venv','Scripts','python.exe'),leaseFile=path.join(HERE,'data','gpu-lease.json'),runProcess=run,measureTokens}={}){
 const environment={HF_HOME:path.join(root,'cache','huggingface'),HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',TEMP:path.join(root,'tmp'),TMP:path.join(root,'tmp')};
 const script=path.join(HERE,'qwen-evolution.py');
 async function status(){
  let preflight;try{preflight=JSON.parse(await fs.readFile(path.join(root,'preflight.json'),'utf8'));}catch{}
  let download=null;try{const record=JSON.parse(await fs.readFile(path.join(root,'download-status.json'),'utf8'));const modelRoot=path.join(root,'models','Qwen3.5-9B');let downloadedBytes=0;for(const item of record.files||[]){if(/^[A-Za-z0-9_.-]+$/.test(item.name))downloadedBytes+=await fs.stat(path.join(modelRoot,item.name)).then(stat=>stat.size).catch(()=>0);}const cache=path.join(modelRoot,'.cache','huggingface','download');for(const file of await fs.readdir(cache,{recursive:true}).catch(()=>[])){if(file.endsWith('.incomplete'))downloadedBytes+=await fs.stat(path.join(cache,file)).then(stat=>stat.size).catch(()=>0);}download={status:record.status,totalBytes:record.totalBytes||0,downloadedBytes:Math.min(record.totalBytes||0,downloadedBytes),verifiedFiles:record.verified?.length||0,totalFiles:record.files?.length||0};}catch{}
  const jobs=(await fs.readdir(path.join(root,'jobs')).catch(()=>[])).filter(id=>ID.test(id));let latest=null,latestAt=0,candidatesTrained=0;
  for(const id of jobs){try{const file=path.join(root,'jobs',id,'result.json'),value=JSON.parse(await fs.readFile(file,'utf8')),at=(await fs.stat(file)).mtimeMs;if(value.trained===true)candidatesTrained++;if(at>=latestAt){latest=value;latestAt=at;}}catch{}}
  return {model:{...QWEN_EVOLUTION_MODEL},prepared:!!preflight,probePrepared:preflight?.experimentalProbePrepared===true,ready:preflight?.trainingReady===true,state:preflight?.trainingReady?'candidate_runtime_ready':preflight?.experimentalProbePrepared?'first_memory_probe_pending':'preflight_required_or_blocked',qwenWeightsChanged:false,activeAdapter:false,download,candidatesPrepared:jobs.length,candidatesTrained,preflight:preflight?{at:preflight.at,dependencies:preflight.dependencies,modelPresent:preflight.modelPresent,experimentalProbePrepared:preflight.experimentalProbePrepared===true,blocks:preflight.blocks,bf16LoraRecommendedVramGb:22,availableGpuVramGb:12,experimentalQuantization:true}:null,lastCandidate:latest?{id:latest.id,trained:latest.trained,gate:latest.gate,scope:latest.scope}:null};
 }
 async function preflight(){return runProcess(python,[script,'preflight','--root',root],{env:{...environment,CUDA_VISIBLE_DEVICES:''},timeout:60000});}
 async function persistCorpus(corpus){
  if((await fs.readdir(path.join(root,'jobs')).catch(()=>[])).filter(id=>ID.test(id)).length>=128)throw Error('El laboratorio conserva 128 candidatos; revisa sus resultados antes de preparar más.');
  const corpusText=json(corpus),id='qw-'+randomUUID().replaceAll('-',''),directory=path.join(root,'jobs',id);
  await fs.mkdir(directory,{recursive:true});const job=validateEvolutionJob({version:1,id,model:QWEN_EVOLUTION_MODEL,profile:'qlora-experimental',rank:4,maxSequenceLength:128,steps:8,learningRate:0.00001,corpusSha256:sha(corpusText),runnerSha256:sha(await fs.readFile(script))});
  await fs.writeFile(path.join(directory,'corpus.json'),corpusText);await fs.writeFile(path.join(directory,'job.json'),json(job));return {...job,trained:false,active:false,...(corpus.provenance?{learningDataFingerprint:corpus.provenance.learningDataFingerprint,verifiedTools:corpus.provenance.tools}:{} )};
 }
 async function prepareCandidate(options={}){return persistCorpus(evolutionCorpus(options));}
 async function tokenLengths(records){
  if(measureTokens)return measureTokens(records);
  const temporary=path.join(root,'tmp','corpus-check-'+randomUUID()+'.json');await fs.mkdir(path.dirname(temporary),{recursive:true});await fs.writeFile(temporary,json(records),{flag:'wx'});
  const code='import importlib.util,json,sys; from transformers import AutoTokenizer; spec=importlib.util.spec_from_file_location("atlas_weight_runner",sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); t=AutoTokenizer.from_pretrained(sys.argv[2],local_files_only=True,trust_remote_code=False); rows=json.load(open(sys.argv[3],encoding="utf-8")); lengths=[len(m.encode_training(t,r,100000)["input_ids"]) for r in rows]; print(json.dumps({"type":"result","result":{"lengths":lengths}}))';
  try{const result=await runProcess(python,['-c',code,script,path.join(root,'models','Qwen3.5-9B'),temporary],{env:{...environment,CUDA_VISIBLE_DEVICES:''},timeout:60000});if(!Array.isArray(result.lengths)||result.lengths.length!==records.length)throw Error('No se pudo medir el corpus con el tokenizer original.');return result.lengths;}finally{await fs.rm(temporary,{force:true});}
 }
 async function prepareFromVerifiedTools(records){
  if(!Array.isArray(records)||records.length>200)throw Error('La lista de herramientas no es válida.');
  const {executePure}=await import('./extensions.mjs'),verified=[],seen=new Set();
  for(const record of [...records].sort((a,b)=>String(a?.curriculumTaskId).localeCompare(String(b?.curriculumTaskId)))){
   const task=getAutonomousTask(record?.curriculumTaskId);
   if(!task||!TOOL_INSTRUCTIONS[task.id]||seen.has(task.id)||record.passed!==true||record.origin!=='autonomous-local-programming'||record.testOrigin!=='external-contract'||typeof record.id!=='string'||typeof record.source!=='string'||record.source.length>16000||!isDeepStrictEqual(record.acceptanceTests,task.acceptanceTests))continue;
   const results=[];let passed=true;
   for(const test of task.acceptanceTests){try{const actual=await executePure(record.source,test.input);results.push({input:test.input,expected:test.expected,actual});if(!isDeepStrictEqual(actual,test.expected)){passed=false;break;}}catch{passed=false;break;}}
   if(!passed||results.length!==8)continue;
   seen.add(task.id);verified.push({task,id:record.id,sourceSha256:sha(record.source),contractSha256:sha(json(task.acceptanceTests)),executionProofSha256:sha(json(results))});if(verified.length===4)break;
  }
  if(!verified.length)throw Error('No hay herramientas autónomas con ocho contratos externos reejecutados y aprobados.');
  const candidates=verified.flatMap(tool=>tool.task.acceptanceTests.map((test,index)=>({tool,index,test})).filter(({test})=>JSON.stringify(test.input).length<=80&&JSON.stringify(test.expected).length<=80).map(({tool,index,test})=>{
   const prompt=TOOL_INSTRUCTIONS[tool.task.id]+JSON.stringify(test.input),answer=structuredClone(test.expected);
   return {id:sha(json({prompt,answer})),family:'verified-tool-'+tool.task.id,prompt,answer,provenance:{origin:'autonomous-local-programming',verification:'quickjs-recomputed-external-contract-v1',privateHistory:false,toolId:tool.id,curriculumTaskId:tool.task.id,sourceSha256:tool.sourceSha256,contractSha256:tool.contractSha256,executionProofSha256:tool.executionProofSha256,caseIndex:index}};
  }));
  const lengths=await tokenLengths(candidates),usable=candidates.filter((_,index)=>Number.isInteger(lengths[index])&&lengths[index]>0&&lengths[index]<=128),train=[],holdout=[],tools=[];
  for(const tool of verified){const rows=usable.filter(row=>row.provenance.toolId===tool.id);if(rows.length<4)continue;
   const ranked=[...rows].sort((a,b)=>{const useful=row=>!Object.hasOwn(row.answer,'error')&&Object.values(tool.task.acceptanceTests[row.provenance.caseIndex].input).some(value=>Array.isArray(value)&&value.length>0);return Number(useful(b))-Number(useful(a))||a.provenance.caseIndex-b.provenance.caseIndex;});
   const selected=ranked.slice(0,2),selectedIds=new Set(selected.map(row=>row.id));train.push(...selected.map(row=>({...row,split:'train'})));holdout.push(...rows.filter(row=>!selectedIds.has(row.id)).map(row=>({...row,split:'holdout'})));tools.push({toolId:tool.id,curriculumTaskId:tool.task.id,sourceSha256:tool.sourceSha256,contractSha256:tool.contractSha256,executionProofSha256:tool.executionProofSha256,reexecutedCases:8,trainCases:2,holdoutCases:rows.length-2});
  }
  if(!train.length)throw Error('Ninguna herramienta tiene ejemplos suficientemente cortos para el perfil de 128 tokens.');
  const base=evolutionCorpus(),learningDataFingerprint=sha(json([...train,...holdout].map(({prompt,answer})=>({prompt,answer})).sort((a,b)=>a.prompt.localeCompare(b.prompt))));
  const corpus={...base,train:[...train,...base.train],holdout:[...holdout,...base.holdout],provenance:{origin:'verified-autonomous-tool-curriculum-v1',learningDataFingerprint,tools},scope:'Muestras nuevas de herramientas propias aprobadas en ocho contratos QuickJS reejecutados; confirmación acotada de formatos y algoritmos JSON, no prueba de inteligencia general. La batería de herramientas ya se usó para reparar su código: no es una prueba ciega del generador de herramientas.'};
  return persistCorpus(corpus);
 }
 async function trainCandidate(id,{signal,onProgress=()=>{}}={}){
  if(!ID.test(id))throw Error('Identificador de candidato inválido.');
  try{await fs.access(path.join(root,'jobs',id,'result.json'));throw Error('Este candidato ya tiene un resultado y se conserva sin sobrescribirlo.');}catch(error){if(error.code!=='ENOENT')throw error;}
  const job=validateEvolutionJob(JSON.parse(await fs.readFile(path.join(root,'jobs',id,'job.json'),'utf8'))),corpusText=await fs.readFile(path.join(root,'jobs',id,'corpus.json'),'utf8');
  if(sha(await fs.readFile(script))!==job.runnerSha256)throw Error('El entrenador cambió; prepara un candidato nuevo y conserva el anterior.');
  if(sha(corpusText)!==job.corpusSha256)throw Error('El corpus cambió desde su preparación.');
  const lease=JSON.parse(await fs.readFile(leaseFile,'utf8'));
  if(lease.role!=='training'||lease.ownerPid!==process.pid||lease.expiresAt<=Date.now()||typeof lease.nonce!=='string')throw Error('Reserva exclusiva de entrenamiento no disponible.');
  return runProcess(python,[script,'train','--root',root,'--id',id,'--lease-file',leaseFile,'--owner-pid',String(process.pid),'--nonce',lease.nonce],{signal,onEvent:onProgress,env:environment,timeout:1800000});
 }
 async function exportCandidate(id,{signal,onProgress=()=>{}}={}){
  if(!ID.test(id))throw Error('Identificador de candidato inválido.');
  const result=JSON.parse(await fs.readFile(path.join(root,'jobs',id,'result.json'),'utf8'));if(result.trained!==true)throw Error('El candidato todavía no tiene un adaptador entrenado.');
  return runProcess(python,[script,'export','--root',root,'--id',id],{signal,onEvent:onProgress,env:{...environment,CUDA_VISIBLE_DEVICES:''},timeout:240000});
 }
 return {status,preflight,prepareCandidate,prepareFromVerifiedTools,trainCandidate,exportCandidate};
}
