import {evaluateExtension,executePure,validateAcceptance} from './extensions.mjs';
import {isDeepStrictEqual} from 'node:util';
const MAX_BATCH_CASES=32,MAX_BATCH_BYTES=100000,MAX_DURATION_MS=30000,MAX_PREPARED_BYTES=8000000;

/** Regressions are retained in full. Each sandbox call and each scheduling
 * batch is bounded; an exhausted whole-run budget is an incomplete rejection,
 * never an approval obtained by dropping historical cases.
 */
export async function checkToolContract(item,{signal,batchSize=MAX_BATCH_CASES,maxDurationMs=MAX_DURATION_MS,now=Date.now}={}){
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>MAX_BATCH_CASES||!Number.isFinite(maxDurationMs)||maxDurationMs<1||maxDurationMs>MAX_DURATION_MS||typeof now!=='function')throw Error('Presupuesto de contratos inválido');
 signal?.throwIfAborted();const started=now();
 const acceptance=validateAcceptance(item.acceptanceTests||[]);
 const inherited=item.regressionTests||[];
 if(!Array.isArray(inherited))throw Error('Contrato heredado inválido');
 const cases=[],seen=new Set();let duplicateCases=0,preparedBytes=0;
 for(const test of [...acceptance,...inherited]){
  signal?.throwIfAborted();
  if(now()-started>=maxDurationMs||preparedBytes>MAX_PREPARED_BYTES)return {passed:false,complete:false,modelResults:[],contractResults:[],reason:'contract_preparation_budget_exhausted',coverage:{total:acceptance.length+inherited.length,evaluated:0,batches:0,batchSize,duplicateCases}};
  if(!test||!Object.hasOwn(test,'input')||!Object.hasOwn(test,'expected'))throw Error('Caso heredado inválido');
  let encoded;try{encoded=JSON.stringify([test.input,test.expected]);}catch{throw Error('Caso heredado inválido');}
  if(encoded.length>MAX_BATCH_BYTES)throw Error('Caso heredado supera el presupuesto individual');
  // Exact JSON transport duplicates only. Reordering an object's keys could
  // hide a bug in a function that observes key enumeration, so keep variants.
  if(seen.has(encoded)){duplicateCases++;continue;}seen.add(encoded);
  preparedBytes+=encoded.length;
  if(preparedBytes>MAX_PREPARED_BYTES)return {passed:false,complete:false,modelResults:[],contractResults:[],reason:'contract_preparation_budget_exhausted',coverage:{total:acceptance.length+inherited.length,evaluated:0,batches:0,batchSize,duplicateCases}};
  cases.push({test:structuredClone({input:test.input,expected:test.expected}),bytes:encoded.length});
 }
 const model=await evaluateExtension(item);signal?.throwIfAborted();
 const results=[];let batches=0,batchCases=0,batchBytes=0;
 for(const entry of cases){
  signal?.throwIfAborted();if(now()-started>=maxDurationMs)break;
  if(batchCases&&(batchCases>=batchSize||batchBytes+entry.bytes>MAX_BATCH_BYTES)){await new Promise(setImmediate);signal?.throwIfAborted();batchCases=0;batchBytes=0;if(now()-started>=maxDurationMs)break;}
  if(!batchCases)batches++;
  const test=entry.test;
  try{const actual=await executePure(item.source,test.input);signal?.throwIfAborted();results.push({...test,actual,passed:isDeepStrictEqual(actual,test.expected)});}catch(error){signal?.throwIfAborted();results.push({...test,passed:false,error:error.message});}
  batchCases++;batchBytes+=entry.bytes;
 }
 const complete=results.length===cases.length;
 return {passed:model.passed&&complete&&results.every(t=>t.passed),complete,modelResults:model.results,contractResults:results,coverage:{total:cases.length,evaluated:results.length,batches,batchSize,duplicateCases},...(complete?{}:{reason:'contract_budget_exhausted'})};
}
export async function retainContract(candidate,parent,options={}){
 const cases=[...(parent.regressionTests||[]),...(parent.tests||[]),...(parent.acceptanceTests||[])];
 const seen=new Set();candidate.regressionTests=cases.filter(t=>{const k=JSON.stringify([t.input,t.expected]);if(seen.has(k))return false;seen.add(k);return true;});
 try{candidate.contractCheck=await checkToolContract(candidate,options);candidate.passed=candidate.passed&&candidate.contractCheck.passed;}
 catch(e){options.signal?.throwIfAborted();candidate.passed=false;candidate.contractCheck={passed:false,error:e.message};}
 return candidate;
}
