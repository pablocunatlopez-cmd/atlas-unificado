import {createHash} from 'node:crypto';
import {evaluateAtlasCandidate} from './atlas-evaluation-gate.mjs';
const digest=value=>'sha256:'+createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,100}$/.test(x);
const validDoc=x=>typeof x==='string'&&x.length>0&&x.length<=200;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const quantile95=values=>values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
/** Offline, deterministic and paired retrieval evaluation. Inputs must be independently labeled.
 * No network, model execution, private corpus reads, or automatic promotion.
 */
export function evaluatePairedRetrieval(cases,baselineRuns,candidateRuns,{minimumQueries=100,protocol='retrieval-v1'}={}){
 if(!Array.isArray(cases)||!Array.isArray(baselineRuns)||!Array.isArray(candidateRuns)||
  !Number.isInteger(minimumQueries)||minimumQueries<1||typeof protocol!=='string'||!protocol.trim()||
  cases.length===0||cases.length>10000)throw new TypeError('Invalid evaluation inputs');
 const gold=new Map();
 for(const c of cases){
  if(!c||!validId(c.id)||gold.has(c.id)||!Array.isArray(c.relevantIds)||!c.relevantIds.length||
   c.relevantIds.length>100||!c.relevantIds.every(validDoc)||new Set(c.relevantIds).size!==c.relevantIds.length)
   throw new TypeError('Invalid gold labels or duplicate case');
  gold.set(c.id,c.relevantIds);
 }
 const parse=(runs)=>{
  if(runs.length!==gold.size)throw new TypeError('Evaluation must include every case exactly once');
  const byId=new Map();
  for(const r of runs){
   if(!r||!gold.has(r.id)||byId.has(r.id)||!Array.isArray(r.retrievedIds)||
    r.retrievedIds.length>50||!r.retrievedIds.every(validDoc)||
    new Set(r.retrievedIds).size!==r.retrievedIds.length||
    !finite(r.latencyMs)||r.latencyMs<=0||!finite(r.memoryMb)||r.memoryMb<=0||
    typeof r.citationCorrect!=='boolean')
    throw new TypeError('Invalid run, duplicate, or missing independent citation label');
   byId.set(r.id,r);
  }
  return byId;
 };
 const base=parse(baselineRuns),next=parse(candidateRuns);
 const summary=byId=>{
  const recall=[],ndcg=[],citation=[],latency=[],memory=[];
  for(const [id,expected] of gold){
   const r=byId.get(id),relevant=new Set(expected),top=r.retrievedIds.slice(0,5);
   const hits=top.filter(x=>relevant.has(x)).length;
   recall.push(hits/expected.length);
   const dcg=top.reduce((v,x,i)=>v+(relevant.has(x)?1/Math.log2(i+2):0),0);
   const ideal=Array.from({length:Math.min(5,expected.length)},(_,i)=>1/Math.log2(i+2)).reduce((a,b)=>a+b,0);
   ndcg.push(dcg/ideal);
   citation.push(r.citationCorrect?1:0);latency.push(r.latencyMs);memory.push(r.memoryMb);
  }
  return {queries:gold.size,recallAt5:mean(recall),ndcgAt5:mean(ndcg),citationAccuracy:mean(citation),latencyP95Ms:quantile95(latency),memoryMb:Math.max(...memory)};
 };
 const corpusHash=digest([...gold.entries()].sort(([a],[b])=>a.localeCompare(b)));
 const protocolHash=digest({protocol,cutoff:5,metrics:['recallAt5','ndcgAt5','citationAccuracy','latencyP95Ms','memoryMb']});
 const baseline={...summary(base),corpusHash,protocolHash};
 const candidate={...summary(next),corpusHash,protocolHash};
 const gate=evaluateAtlasCandidate(baseline,candidate,{minimumQueries});
 return Object.freeze({baseline,candidate,gate,source:'caller-provided-independent-labels',verifiedByExternalEvaluator:false,autoPromote:false});
}
