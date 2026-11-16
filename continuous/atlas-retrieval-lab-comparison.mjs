import {performance} from 'node:perf_hooks';
import {evaluatePairedRetrieval} from './atlas-paired-retrieval-evaluation.mjs';
/** Execute two real in-memory retrieval strategies on the same declared corpus.
 * Citation correctness is NOT inferred from relevance; independent labels are mandatory.
 * Memory is process RSS (not model-specific). Does not read canonical Atlas memory.
 */
export function compareRetrievalLabStrategies(lab,cases,{
 baselineMethod='atlas-lexical',candidateMethod='fts5',
 citationLabels,minimumQueries=100,limit=5,protocol='retrieval-lab-paired-v2',warmupRounds=1,measurementRounds=5
}={}){
 if(!lab||typeof lab.search!=='function'||!Array.isArray(cases)||!cases.length||
  !['atlas-lexical','fts5'].includes(baselineMethod)||!['atlas-lexical','fts5'].includes(candidateMethod)||
  !Number.isInteger(limit)||limit!==5||!citationLabels||
  typeof citationLabels!=='object'||Array.isArray(citationLabels)||
  !Number.isInteger(warmupRounds)||warmupRounds<0||warmupRounds>10||
  !Number.isInteger(measurementRounds)||measurementRounds<1||measurementRounds>30)
  throw new TypeError('Invalid lab comparison');
 const seen=new Set(),gold=[];
 for(const c of cases){
  if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,100}$/.test(c.id)||seen.has(c.id)||
   typeof c.question!=='string'||!c.question.trim()||c.question.length>6000||
   !Array.isArray(c.relevantIds)||!c.relevantIds.length)throw new TypeError('Invalid evaluation case');
  seen.add(c.id);gold.push({id:c.id,relevantIds:c.relevantIds});
 }
 const methods=[baselineMethod,candidateMethod];
 // Validate all labels before executing either engine, avoiding partial runs.
 for(const c of cases)for(const method of new Set(methods))
  if(typeof citationLabels[c.id]?.[method]!=='boolean')
   throw new TypeError('Independent citation labels required for each method and case');
 const samples=[new Map(),new Map()];
 const median=values=>{const ordered=[...values].sort((a,b)=>a-b);const mid=Math.floor(ordered.length/2);return ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;};
 // Alternate AB/BA by case and round. Warmup is excluded from measurements.
 for(let round=-warmupRounds;round<measurementRounds;round++){
  for(let i=0;i<cases.length;i++){
   const c=cases[i],order=(round+i+warmupRounds)%2===0?[0,1]:[1,0];
   for(const index of order){
    const method=methods[index],start=performance.now();
    const retrievedIds=lab.search(c.question,{method,limit}).map(x=>x.id);
    const latencyMs=Math.max(Number.EPSILON,performance.now()-start);
    if(round<0)continue;
    const memoryMb=Math.max(Number.EPSILON,process.memoryUsage().rss/(1024*1024));
    const entries=samples[index].get(c.id)||[];
    entries.push({retrievedIds,latencyMs,memoryMb});
    samples[index].set(c.id,entries);
   }
  }
 }
 const aggregate=index=>cases.map(c=>{
  const values=samples[index].get(c.id);
  const first=JSON.stringify(values[0].retrievedIds);
  if(values.some(x=>JSON.stringify(x.retrievedIds)!==first))
   throw new Error('Retrieval results changed across measurement rounds');
  return {id:c.id,retrievedIds:values[0].retrievedIds,
   latencyMs:median(values.map(x=>x.latencyMs)),
   memoryMb:Math.max(...values.map(x=>x.memoryMb)),
   citationCorrect:citationLabels[c.id][methods[index]]};
 });
 const baselineRuns=aggregate(0),candidateRuns=aggregate(1);
 if(typeof lab.corpusHash!=='string'||!/^[a-f0-9]{64}$/.test(lab.corpusHash))throw new TypeError('Missing actual document corpus fingerprint');
 const documentCorpusHash='sha256:'+lab.corpusHash;
 return Object.freeze({baselineMethod,candidateMethod,
  ...evaluatePairedRetrieval(gold,baselineRuns,candidateRuns,{minimumQueries,protocol,documentCorpusHash}),
  measurementScope:'Local retrieval only; alternating AB/BA order, excluded warmup, per-query median latency and process RSS; excludes generation and embeddings.',
  measurementProtocol:Object.freeze({warmupRounds,measurementRounds,order:'alternating-AB-BA',latency:'per-query-median',memory:'peak-process-rss'}),
  citationLabelScope:'Externally supplied labels, not independently verified by this module',
  corpusSource:'caller-provided-lab',networkCalls:0,modelDownloads:0});
}
