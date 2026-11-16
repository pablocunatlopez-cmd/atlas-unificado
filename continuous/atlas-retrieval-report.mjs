import {createHash} from 'node:crypto';
const sha=x=>'sha256:'+createHash('sha256').update(JSON.stringify(x)).digest('hex');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
/** Reproducible, content-minimizing report of a paired retrieval experiment.
 * Does not publish queries, documents, answers, or private source text.
 * Caller-provided citation labels are not independently authenticated.
 */
export function buildAtlasRetrievalReport(result,{baselineVersion='unknown',candidateVersion='unknown'}={}){
 if(!result||!result.baseline||!result.candidate||!result.gate||!result.review||
  !Array.isArray(result.perQuery)||typeof result.baseline.corpusHash!=='string'||
  result.baseline.corpusHash!==result.candidate.corpusHash||
  result.baseline.protocolHash!==result.candidate.protocolHash||
  !['review-required','reject','insufficient-evidence'].includes(result.gate.verdict)||
  typeof result.gate.promote!=='boolean'||result.gate.promote!==false||
  !['human-review','retain-baseline','collect-more-evidence'].includes(result.review.recommendation)||
  ![baselineVersion,candidateVersion].every(x=>typeof x==='string'&&x.length<=120))
  throw new TypeError('Invalid paired retrieval report');
 const metrics=['queries','recallAt5','ndcgAt5','citationAccuracy','latencyP95Ms','memoryMb'];
 for(const key of metrics)if(!finite(result.baseline[key])||!finite(result.candidate[key]))throw new TypeError('Invalid metric');
 if(result.perQuery.length!==result.baseline.queries||result.perQuery.length!==result.candidate.queries)
  throw new TypeError('Unpaired per-query records');
 const rows=result.perQuery.map(r=>{
  if(!r||typeof r.id!=='string'||!r.id||!['improved','regressed','unchanged'].includes(r.qualityChange)||
   typeof r.citationRegression!=='boolean'||!r.baseline||!r.candidate)
   throw new TypeError('Invalid per-query record');
  return {caseFingerprint:sha(r.id),qualityChange:r.qualityChange,citationRegression:r.citationRegression,
   baselineNdcgAt5:r.baseline.ndcgAt5,candidateNdcgAt5:r.candidate.ndcgAt5};
 });
 const report={schema:'atlas-retrieval-report-v1',baselineVersion,candidateVersion,
  corpusHash:result.baseline.corpusHash,protocolHash:result.baseline.protocolHash,
  documentCorpusHash:result.documentCorpusHash??null,labelsHash:result.labelsHash??null,
  baseline:Object.fromEntries(metrics.map(k=>[k,result.baseline[k]])),
  candidate:Object.fromEntries(metrics.map(k=>[k,result.candidate[k]])),
  gate:{verdict:result.gate.verdict,reasons:result.gate.reasons,promote:false},
  recommendation:result.review.recommendation,requiresHumanApproval:true,
  perQuery:rows,independentCitationVerification:false,
  warning:'Labels and timings are caller-provided or locally measured; no factual truth or deployment authorization is established.'};
 return Object.freeze({...report,reportHash:sha(report)});
}
