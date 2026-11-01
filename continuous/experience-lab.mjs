import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {executePure} from './extensions.mjs';
import {getAutonomousTask} from './autonomy-curriculum.mjs';

const FIELDS=['O','A','X','R','T','I','C','E','M','P','F','Σ'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>Object.hasOwn(value,key);
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const json=value=>JSON.stringify(canonical(value));
const hash=value=>createHash('sha256').update(value).digest('hex');
const copy=value=>structuredClone(value);
function random(seed){let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};}
const integer=(r,min,max)=>min+Math.floor(r()*(max-min+1));
function shuffle(values,r){const result=copy(values);for(let i=result.length-1;i>0;i--){const j=integer(r,0,i);[result[i],result[j]]=[result[j],result[i]];}return result;}

// These oracles are fixed coordinator code, independent of any generated tool.
function dagOracle(input){
 if(!object(input)||!Array.isArray(input.tasks))return {error:'invalid_tasks'};
 const deps=new Map();
 for(const task of input.tasks){if(!object(task)||typeof task.id!=='string'||!task.id.length||deps.has(task.id)||!Array.isArray(task.dependsOn)||task.dependsOn.some(id=>typeof id!=='string'))return {error:'invalid_tasks'};deps.set(task.id,new Set(task.dependsOn));}
 for(const required of deps.values())for(const id of required)if(!deps.has(id))return {error:'invalid_tasks'};
 const order=[],chosen=new Set();
 while(chosen.size<deps.size){const ready=[...deps.keys()].filter(id=>!chosen.has(id)&&[...deps.get(id)].every(dep=>chosen.has(dep))).sort();if(!ready.length)break;order.push(ready[0]);chosen.add(ready[0]);}
 return {order,blocked:[...deps.keys()].filter(id=>!chosen.has(id)).sort()};
}
function pointerOracle(input){
 if(!object(input)||!own(input,'document')||typeof input.pointer!=='string')return {found:false,error:'invalid_input'};
 const pointer=input.pointer;if(pointer!==''&&!pointer.startsWith('/')||/~(?![01])/.test(pointer))return {found:false,error:'invalid_pointer'};
 if(pointer==='')return {found:true,value:copy(input.document)};
 let value=input.document;
 for(const encoded of pointer.slice(1).split('/')){
  const token=encoded.replace(/~[01]/g,pair=>pair==='~1'?'/':'~');
  if(Array.isArray(value)){
   if(!/^(?:0|[1-9][0-9]*)$/.test(token)||!Number.isSafeInteger(Number(token))||Number(token)>=value.length)return {found:false,error:'not_found'};
   value=value[Number(token)];
  }else if(object(value)&&own(value,token))value=value[token];else return {found:false,error:'not_found'};
 }
 return {found:true,value:copy(value)};
}
function statisticsOracle(input){
 if(!object(input)||!Array.isArray(input.values)||input.values.some(value=>typeof value!=='number'||!Number.isFinite(value)))return {error:'invalid_numbers'};
 let sum=0;for(const value of input.values){sum+=value;if(!Number.isFinite(sum))return {error:'invalid_numbers'};}
 const values=[...input.values].sort((a,b)=>a-b),count=values.length,middle=Math.floor(count/2);
 return {count,sum,min:count?values[0]:null,max:count?values.at(-1):null,mean:count?sum/count:null,median:count?(count%2?values[middle]:(values[middle-1]+values[middle])/2):null};
}
function dedupeOracle(input){
 if(!object(input)||!Array.isArray(input.values)||input.values.some(value=>value!==null&&!['string','boolean'].includes(typeof value)&&!(typeof value==='number'&&Number.isFinite(value))))return {error:'invalid_values'};
 const values=[];for(const value of input.values)if(!values.some(previous=>previous===value))values.push(value);return {values};
}
function intervalsOracle(input){
 if(!object(input)||!Array.isArray(input.intervals)||input.intervals.some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(value=>typeof value!=='number'||!Number.isFinite(value))))return {error:'invalid_intervals'};
 const sorted=input.intervals.map(([a,b])=>a<=b?[a,b]:[b,a]).sort((a,b)=>a[0]-b[0]),intervals=[];
 for(const range of sorted){const previous=intervals.at(-1);if(previous&&range[0]<=previous[1])previous[1]=Math.max(previous[1],range[1]);else intervals.push([...range]);}return {intervals};
}
function lorOracle(input){
 if(!object(input)||!object(input.S))return {valid:false,missing:[...FIELDS],extra:[]};
 const missing=FIELDS.filter(key=>!own(input.S,key)),extra=Object.keys(input.S).filter(key=>!FIELDS.includes(key)).sort();return {valid:missing.length===0&&extra.length===0,missing,extra};
}

const GENERATORS={
 'dag-dependency-plan':(r,seed)=>{
  const tag=seed.toString(36),names=['a','b','c','z','root','tail'].map(prefix=>prefix+'_'+tag+'_'+integer(r,0,9999));
  const [a,b,c,z,root,tail]=names,task=(id,dependsOn=[])=>({id,dependsOn});
  return [
   {tasks:shuffle([task(c),task(a,[b]),task(b)],r)},
   {tasks:shuffle([task(tail,[c]),task(c,[b]),task(b,[a]),task(a)],r)},
   {tasks:shuffle([task(b,[a,a]),task(a),task(z, r()>.5?[b]:[])],r)},
   {tasks:shuffle([task(root),task(a,[root]),task(b,[root]),task(tail,[a,b]),task(z,r()>.5?[a]:[b])],r)},
   {tasks:shuffle([task(a,[b]),task(b,[a]),task(tail,[b]),task(root)],r)},
   {tasks:shuffle([task(a,[a]),task(root),task(tail,[a,root])],r)},
   {tasks:[task(root,[`missing_${tag}_${integer(r,1,9999)}`])]},
   {tasks:[task(root),task(root,[root])]},
  ];
 },
 'json-pointer-resolve':(r,seed)=>{
  const n=integer(r,-10000,10000),label='value_'+seed.toString(36),key='a/b_'+integer(r,1,999),nested='~key_'+integer(r,1,999),index=integer(r,0,2),encode=value=>value.replaceAll('~','~0').replaceAll('/','~1');
  return [
   {document:{value:n,label},pointer:''},
   {document:{[key]:{[nested]:n}},pointer:'/'+encode(key)+'/'+encode(nested)},
   {document:{'~1':label,'/':n},pointer:'/~01'},
   {document:{items:[{value:n},{value:n+1},{value:n+2}]},pointer:'/items/'+index+'/value'},
   {document:{items:[n,n+1,n+2]},pointer:'/items/0'+integer(r,0,2)},
   {document:{value:n},pointer:'/value/bad~2'},
   {document:{outer:{'':r()>.5?null:label}},pointer:'/outer/'},
   r()>.5?{document:JSON.parse('{"__proto__":{"value":'+n+'},"constructor":"'+label+'"}'),pointer:'/__proto__/value'}:{document:{'%2F':n,'/':label},pointer:'/%2F'},
  ];
 },
 'numeric-statistics':r=>{
  const n=integer(r,-1000,1000),fraction=integer(r,1,100)/8,huge=Number.MAX_VALUE*(.75+r()/8);
  return [[n,n+1,n+2],[n,n+2,n+4,n+6],[integer(r,11,99),2,integer(r,100,999)],[n,n,n-1,n+1,n],[-Math.abs(n)-1,-Math.abs(n)-5,-fraction],[fraction,.25,-fraction,.5],[n,String(n)],[huge,huge]].map(values=>({values}));
 },
 'stable-dedupe':(r,seed)=>{
  const n=integer(r,-10000,10000),label='text_'+seed.toString(36),fraction=integer(r,1,100)/8;
  return [[n,n-1,n,n+1,n-1],[n,String(n),true,n,String(n),false,null],['',false,null,0,label,'',0,false,null],['__proto__',label,'constructor','__proto__',label],['á','a','A',label,'🌍','á','🌍'],[fraction,-fraction,fraction,0,0],[n,{value:n}],{not:'an array',value:n}].map(values=>({values}));
 },
 'merge-intervals':r=>{
  const n=integer(r,-1000,1000),fraction=integer(r,1,100)/4;
  return [
   [[n+5,n+8],[n+1,n+3],[n+2,n+6],[n+12,n+14]],[[n,n+20],[n+2,n+3],[n+4,n+10]],[[n,n+1],[n+1,n+2],[n+2,n+2]],[[n+4,n+1],[n-1,n-3],[n,n-1]],[[n,n],[n+3,n+3]],[[fraction,fraction+.5],[fraction+.25,fraction+.75]],[[n,String(n+1)]],[[n,n+1,n+2]],
  ].map(intervals=>({intervals:shuffle(intervals,r)}));
 },
 'lor-omega-schema':(r,seed)=>{
  const n=integer(r,1,10000),full=Object.fromEntries(FIELDS.map((key,index)=>[key,index%3===0?null:index%3===1?[n,index]:false]));
  const missing=copy(full);delete missing[FIELDS[integer(r,0,FIELDS.length-1)]];
  return [{S:full},{S:missing},{S:{...copy(full),['extra_'+seed.toString(36)]:n,unknown:n+1}},{S:n},{S:[n]},{S:'symbols_'+seed.toString(36)},{S:{[FIELDS[integer(r,0,FIELDS.length-1)]]:n}},{S:{...copy(full),constructor:'data_'+n,toString:null}}];
 },
};
const ORACLES={'dag-dependency-plan':dagOracle,'json-pointer-resolve':pointerOracle,'numeric-statistics':statisticsOracle,'stable-dedupe':dedupeOracle,'merge-intervals':intervalsOracle,'lor-omega-schema':lorOracle};
// A seed changes values inside these patterns, never their coverage version.
// Change this manifest only when the fixed oracle/pattern coverage changes.
export const EXPERIENCE_COVERAGE_VERSION='bounded-json-patterns-v1';
const COVERAGE={
 'dag-dependency-plan':['dynamic-ready-order','chain','duplicate-edge','branching','cycle-descendants','self-cycle','unknown-dependency','duplicate-id'],
 'json-pointer-resolve':['root','escaped-path','escape-order','nested-index','leading-zero','full-syntax','empty-token','own-or-percent-key'],
 'numeric-statistics':['odd','even','numeric-order','duplicates','negative','fractions','invalid-type','sum-overflow'],
 'stable-dedupe':['order','distinct-types','falsy','special-keys','unicode','fractions','invalid-member','invalid-container'],
 'merge-intervals':['overlap','contained','touching','reversed','points','fractions','invalid-number','invalid-pair'],
 'lor-omega-schema':['complete','missing','unknown','number','array','string','partial','own-special-keys']
};
function baseCoverage(taskId){
 if(!Object.hasOwn(COVERAGE,taskId))throw Error('Familia de experiencia no admitida.');
 return {coverageVersion:EXPERIENCE_COVERAGE_VERSION,coverageHash:hash(json({taskId,version:EXPERIENCE_COVERAGE_VERSION,patterns:COVERAGE[taskId]}))};
}

export function generateExperienceCases(taskId,seed){
 const task=getAutonomousTask(taskId);if(!Object.hasOwn(GENERATORS,taskId)||!task)throw Error('Familia de experiencia no admitida.');
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('La semilla debe ser un entero uint32.');
 const r=random(seed),known=new Set(task.acceptanceTests.map(test=>json({input:test.input,expected:test.expected})));
 for(let attempt=0;attempt<16;attempt++){
  const inputs=GENERATORS[taskId](r,seed),cases=inputs.map(input=>{const expected=ORACLES[taskId](input),content=json({input,expected});return {id:'case-'+hash(content).slice(0,20),input:copy(input),expected};});
  if(cases.length===8&&new Set(cases.map(item=>item.id)).size===8&&!cases.some(test=>known.has(json({input:test.input,expected:test.expected}))))return cases;
 }
 throw Error('No se pudo construir un lote distinto de los contratos canónicos.');
}
export function experienceEvidenceHash(taskId,cases){
 if(!Object.hasOwn(GENERATORS,taskId)||!Array.isArray(cases)||cases.length!==8||cases.some(item=>!object(item)||!own(item,'input')||!own(item,'expected')))throw Error('Lote de experiencia inválido.');
 return hash(json({taskId,cases:cases.map(({input,expected})=>json({input,expected})).sort()}));
}

function latestTool(tools,taskId){
 return (Array.isArray(tools)?tools:[]).map((tool,index)=>({tool,index,at:Date.parse(tool?.at)||0})).filter(({tool})=>tool?.passed===true&&tool.curriculumTaskId===taskId&&typeof tool.id==='string'&&typeof tool.source==='string'&&tool.source.trim()&&tool.source.length<=15500).sort((a,b)=>b.at-a.at||b.index-a.index)[0]?.tool||null;
}
function instrument(source){return 'function transform(serializedInput){const input=JSON.parse(serializedInput);const execute=(function(){'+source+'\n;return transform;})();const output=execute(input);return {output:output,inputAfter:input};}';}
function boundedActual(actual){try{return JSON.stringify(actual).length<=2000?actual:{truncated:true,type:typeof actual};}catch{return {unserializable:true};}}
const digestValue=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function validBatchEvidence(result){
 try{return result.executed===true&&digestValue(result.sourceHash)&&experienceEvidenceHash(result.taskId,result.cases)===result.evidenceHash&&result.cases.every(item=>isDeepStrictEqual(ORACLES[result.taskId](item.input),item.expected));}catch{return false;}
}
function validCoverageEntry(entry){
 return object(entry)&&Object.hasOwn(COVERAGE,entry.taskId)&&digestValue(entry.sourceHash)&&digestValue(entry.coverageHash)&&typeof entry.coverageVersion==='string'&&Array.isArray(entry.batchHashes)&&entry.batchHashes.every(digestValue)&&new Set(entry.batchHashes).size===entry.batchHashes.length&&Number.isSafeInteger(entry.successfulBatches)&&entry.successfulBatches>=0&&Number.isSafeInteger(entry.contradictoryBatches)&&entry.contradictoryBatches>=0&&entry.successfulBatches+entry.contradictoryBatches===entry.batchHashes.length&&entry.key===hash(json({taskId:entry.taskId,sourceHash:entry.sourceHash,coverageHash:entry.coverageHash}));
}

export function createExperienceLab({directory,execute=executePure,now=()=>new Date().toISOString()}={}){
 const file=path.join(directory,'experience-lab.json');let serial=Promise.resolve(),initialized,state;
 async function save(){await fs.writeFile(file+'.tmp',JSON.stringify(state,null,2));await fs.rename(file+'.tmp',file);}
 function recordCoverage(result){
  if(!validBatchEvidence(result))return;
  const coverage=result.coverageHash?{coverageVersion:result.coverageVersion,coverageHash:result.coverageHash}:baseCoverage(result.taskId),key=hash(json({taskId:result.taskId,sourceHash:result.sourceHash,coverageHash:coverage.coverageHash}));
  let entry=state.coverageLedger.find(item=>item.key===key);
  if(!entry){entry={key,taskId:result.taskId,sourceHash:result.sourceHash,...coverage,successfulBatches:0,contradictoryBatches:0,batchHashes:[]};state.coverageLedger.push(entry);}
  if(!validCoverageEntry(entry))return;
  if(entry.batchHashes.includes(result.evidenceHash))return;
  entry.batchHashes.push(result.evidenceHash);
  const complete=result.total===8&&result.passed===8&&result.baselineTotal>=8&&result.baselinePassed===result.baselineTotal&&result.failures?.length===0&&result.baselineFailures?.length===0;
  if(complete)entry.successfulBatches++;
  else entry.contradictoryBatches++;
 }
 function rememberCounterexamples(result){
  if(!validBatchEvidence(result))return;
  const canonicalCases=new Set(getAutonomousTask(result.taskId).acceptanceTests.map(item=>json({input:item.input,expected:item.expected})));
  for(const item of [...(result.failures||[]),...(result.baselineFailures||[])]){
   if(!object(item)||!own(item,'input')||!own(item,'expected')||!isDeepStrictEqual(ORACLES[result.taskId](item.input),item.expected))continue;
   const content=json({input:item.input,expected:item.expected}),key=hash(json({taskId:result.taskId,content}));
   if(canonicalCases.has(content)||state.counterexamples.some(previous=>previous.key===key))continue;
   state.counterexamples.push({key,taskId:result.taskId,input:copy(item.input),expected:copy(item.expected),sourceHash:result.sourceHash,evidenceHash:result.evidenceHash,at:result.at});
  }
 }
 async function initialize(){if(!initialized)initialized=(async()=>{await fs.mkdir(directory,{recursive:true});try{state=JSON.parse(await fs.readFile(file,'utf8'));if(state.schema!==1||!Array.isArray(state.jobs)||!Array.isArray(state.evidenceHashes)||!Array.isArray(state.executedPairs))throw Error('Estado de experiencias inválido; se conserva.');}catch(error){if(error.code!=='ENOENT')throw error;state={schema:1,jobs:[],evidenceHashes:[],executedPairs:[],requests:0,executedExperiments:0,newEvidenceCount:0,counterexampleExperiments:0,repeatedSkipped:0,unmetGapRequests:0};}
  if(state.counterexamples===undefined){state.counterexamples=[];for(const job of state.jobs)rememberCounterexamples(job);}
  if(!Array.isArray(state.counterexamples))throw Error('Ledger de contraejemplos inválido; se conserva.');
  if(state.coverageLedger===undefined){state.coverageLedger=[];for(const job of state.jobs)recordCoverage(job);}
  if(!Array.isArray(state.coverageLedger))throw Error('Ledger de cobertura inválido; se conserva.');
  for(const job of state.jobs)recordCoverage(job);
  state.coverageSkipped=Number.isSafeInteger(state.coverageSkipped)?state.coverageSkipped:0;await save();
 })();await initialized;}
 function prepare({taskId,seed}){const cases=generateExperienceCases(taskId,seed);return {taskId,seed,cases,total:cases.length,evidenceHash:experienceEvidenceHash(taskId,cases),...baseCoverage(taskId)};}
 function profile(taskId,tool){
  const base=baseCoverage(taskId),canonicalCases=new Set(getAutonomousTask(taskId).acceptanceTests.map(item=>json({input:item.input,expected:item.expected}))),witnessed=new Set();
  // Only previously executed contradictions can expand coverage. Arbitrary
  // regression strings, UUIDs and passing seed variants cannot reset it.
  for(const item of state.counterexamples.filter(item=>item.taskId===taskId)){
   if(!object(item)||!own(item,'input')||!own(item,'expected')||!isDeepStrictEqual(ORACLES[taskId](item.input),item.expected))continue;
   const key=json({input:item.input,expected:item.expected});if(!canonicalCases.has(key))witnessed.add(key);
  }
  const regressions=[],seen=new Set();
  for(const item of Array.isArray(tool?.regressionTests)?tool.regressionTests.slice(-16):[]){
   if(!object(item)||!own(item,'input')||!own(item,'expected'))continue;
   const key=json({input:item.input,expected:item.expected});if(!witnessed.has(key)||seen.has(key))continue;seen.add(key);regressions.push({input:copy(item.input),expected:copy(item.expected)});
  }
  return {...base,coverageHash:regressions.length?hash(json({base:base.coverageHash,counterexamples:[...seen].sort()})):base.coverageHash,regressions};
 }
 function eligibilityValue({taskId,tools}){
  const tool=latestTool(tools,taskId),coverage=profile(taskId,tool),sourceHash=tool?hash(tool.source):null,key=hash(json({taskId,sourceHash,coverageHash:coverage.coverageHash})),entry=state.coverageLedger.find(item=>item.key===key);
  const integrity=!entry||validCoverageEntry(entry),successfulBatches=integrity?(entry?.successfulBatches||0):0,contradictoryBatches=integrity?(entry?.contradictoryBatches||0):0,saturated=successfulBatches>=3&&contradictoryBatches===0;
  return {taskId,eligible:!!tool&&integrity&&!saturated,reason:!tool?'unmet_gap':!integrity?'coverage_unverified':saturated?'coverage_saturated':'ready',sourceHash,coverageVersion:coverage.coverageVersion,coverageHash:coverage.coverageHash,successfulBatches,contradictoryBatches,maximumSuccessfulBatches:3};
 }
 async function eligibility(input){await initialize();await serial;return eligibilityValue(input);}
 async function status(){await initialize();return {requests:state.requests,executedExperiments:state.executedExperiments,newEvidenceCount:state.newEvidenceCount,counterexampleExperiments:state.counterexampleExperiments,repeatedSkipped:state.repeatedSkipped,coverageSkipped:state.coverageSkipped,counterexamplesStored:state.counterexamples.length,unmetGapRequests:state.unmetGapRequests,jobsStored:state.jobs.length,last:copy(state.jobs.at(-1)||null),scope:'Escenarios sintéticos parametrizados; tres lotes completos sin contradicción saturan la misma fuente/cobertura. La semilla no cambia cobertura ni acredita mejora general o pesos.'};}
 async function experiment({taskId,tools,seed,signal}){
  const operation=serial.then(async()=>{
   await initialize();signal?.throwIfAborted();const eligible=eligibilityValue({taskId,tools}),tool=latestTool(tools,taskId),coverage=profile(taskId,tool),blocked=['coverage_saturated','coverage_unverified'].includes(eligible.reason),batch=blocked?{taskId,seed,cases:[],total:0,evidenceHash:null}:prepare({taskId,seed}),sourceHash=eligible.sourceHash,pair=tool&&batch.evidenceHash?hash(batch.evidenceHash+'\n'+sourceHash+'\n'+coverage.coverageHash):null;
   const timestamp=now(),at=typeof timestamp==='number'?new Date(timestamp).toISOString():timestamp;
   const legacyPair=tool&&batch.evidenceHash?hash(batch.evidenceHash+'\n'+sourceHash):null;
   const result={at,...batch,coverageVersion:coverage.coverageVersion,coverageHash:coverage.coverageHash,passed:null,failures:[],toolId:tool?.id||null,sourceHash,baselinePassed:null,baselineTotal:getAutonomousTask(taskId).acceptanceTests.length+coverage.regressions.length,baselineFailures:[],regressionCases:[],executed:false,newEvidence:false,reason:!tool?'unmet_gap':blocked?eligible.reason:state.executedPairs.includes(pair)||!coverage.regressions.length&&state.executedPairs.includes(legacyPair)?'repeated_evidence':null};
   if(!tool)state.unmetGapRequests++;
   else if(blocked)state.coverageSkipped++;
   else if(result.reason==='repeated_evidence')state.repeatedSkipped++;
   else{
    const code=instrument(tool.source);
    const run=async(test,index)=>{
     signal?.throwIfAborted();let measured;
     try{measured=await execute(code,JSON.stringify(test.input),{signal});signal?.throwIfAborted();}catch{signal?.throwIfAborted();return {caseId:test.id||'baseline-'+index,input:copy(test.input),expected:copy(test.expected),reason:'execution_error'};}
     if(!object(measured)||!own(measured,'output')||!own(measured,'inputAfter'))return {caseId:test.id||'baseline-'+index,input:copy(test.input),expected:copy(test.expected),reason:'execution_error'};
     const sameInput=isDeepStrictEqual(measured.inputAfter,test.input),correct=isDeepStrictEqual(measured.output,test.expected);
     return sameInput&&correct?null:{caseId:test.id||'baseline-'+index,input:copy(test.input),expected:copy(test.expected),actual:boundedActual(measured.output),inputUnchanged:sameInput,reason:!sameInput?'input_mutation':'wrong_output'};
    };
    const baseline=[...getAutonomousTask(taskId).acceptanceTests,...coverage.regressions];for(const [index,test] of baseline.entries()){const failure=await run(test,index);if(failure)result.baselineFailures.push(failure);}
    for(const [index,test] of batch.cases.entries()){const failure=await run(test,index);if(failure)result.failures.push(failure);}
    signal?.throwIfAborted();result.baselinePassed=baseline.length-result.baselineFailures.length;result.passed=batch.total-result.failures.length;result.executed=true;result.newEvidence=!state.evidenceHashes.includes(batch.evidenceHash);result.reason=result.failures.length||result.baselineFailures.length?'counterexample_found':'cases_passed';result.regressionCases=result.failures.map(({input,expected})=>({input:copy(input),expected:copy(expected)}));
    state.executedPairs.push(pair);if(result.newEvidence){state.evidenceHashes.push(batch.evidenceHash);state.newEvidenceCount++;}state.executedExperiments++;if(result.failures.length||result.baselineFailures.length)state.counterexampleExperiments++;rememberCounterexamples(result);recordCoverage(result);
   }
   signal?.throwIfAborted();state.requests++;state.jobs.push(result);state.jobs=state.jobs.slice(-100);await save();return copy(result);
  });serial=operation.catch(()=>{});return operation;
 }
 return {prepare,eligibility,experiment,status};
}
