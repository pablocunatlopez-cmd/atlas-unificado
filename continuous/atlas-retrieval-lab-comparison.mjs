import {performance} from 'node:perf_hooks';
import {evaluatePairedRetrieval} from './atlas-paired-retrieval-evaluation.mjs';
/** Execute two real in-memory retrieval strategies on the same declared corpus.
 * Citation correctness is NOT inferred from relevance; independent labels are mandatory.
 * Memory is process RSS (not model-specific). Does not read canonical Atlas memory.
 */
export function compareRetrievalLabStrategies(lab,cases,{
 baselineMethod='atlas-lexical',candidateMethod='fts5',
 citationLabels,minimumQueries=100,limit=5,protocol='retrieval-lab-paired-v1'
}={}){
 if(!lab||typeof lab.search!=='function'||!Array.isArray(cases)||!cases.length||
  !['atlas-lexical','fts5'].includes(baselineMethod)||!['atlas-lexical','fts5'].includes(candidateMethod)||
  !Number.isInteger(limit)||limit!==5||!citationLabels||
  typeof citationLabels!=='object'||Array.isArray(citationLabels))
  throw new TypeError('Invalid lab comparison');
 const seen=new Set(),gold=[];
 for(const c of cases){
  if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,100}$/.test(c.id)||seen.has(c.id)||
   typeof c.question!=='string'||!c.question.trim()||c.question.length>6000||
   !Array.isArray(c.relevantIds)||!c.relevantIds.length)throw new TypeError('Invalid evaluation case');
  seen.add(c.id);gold.push({id:c.id,relevantIds:c.relevantIds});
 }
 const measure=method=>cases.map(c=>{
  const start=performance.now(),retrievedIds=lab.search(c.question,{method,limit}).map(x=>x.id);
  const latencyMs=Math.max(Number.EPSILON,performance.now()-start);
  const memoryMb=Math.max(Number.EPSILON,process.memoryUsage().rss/(1024*1024));
  const label=citationLabels[c.id]?.[method];
  if(typeof label!=='boolean')throw new TypeError('Independent citation labels required for each method and case');
  return {id:c.id,retrievedIds,latencyMs,memoryMb,citationCorrect:label};
 });
 const baselineRuns=measure(baselineMethod),candidateRuns=measure(candidateMethod);
 return Object.freeze({baselineMethod,candidateMethod,
  ...evaluatePairedRetrieval(gold,baselineRuns,candidateRuns,{minimumQueries,protocol}),
  measurementScope:'Local retrieval calls only; includes process RSS and cold/warm scheduling noise; excludes generation and embeddings.',
  citationLabelScope:'Externally supplied labels, not independently verified by this module',
  corpusSource:'caller-provided-lab',networkCalls:0,modelDownloads:0});
}
