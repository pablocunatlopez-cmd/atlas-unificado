/** Hybrid retrieval reranker: neural similarities must be supplied by a real encoder.
 * Never fabricates embeddings or similarity scores. Lexical results are preserved.
 */
export function hybridRerank(lexicalHits,semanticScores,{alpha=0.7,limit=5}={}){
 if(!Array.isArray(lexicalHits)||!Number.isFinite(alpha)||alpha<0||alpha>1||!Number.isInteger(limit)||limit<1||limit>50)throw new TypeError('Invalid retrieval arguments');
 const semantic=semanticScores instanceof Map?semanticScores:new Map();
 // Missing or malformed neural scores must not distort the lexical baseline.
 // Apply fusion only if EVERY candidate has a valid similarity score.
 const complete=lexicalHits.length>0&&lexicalHits.every(hit=>{const v=semantic.get(hit.url);return typeof v==='number'&&Number.isFinite(v)&&v>=-1&&v<=1;});
 return lexicalHits.map((hit,index)=>{
  const value=semantic.get(hit.url);
  const valid=typeof value==='number'&&Number.isFinite(value)&&value>=-1&&value<=1;
  const lexical=Number.isFinite(hit.score)?Math.max(0,Math.min(1,hit.score)):0;
  return {...hit,score:complete&&valid?alpha*lexical+(1-alpha)*(value+1)/2:lexical,rankingMethod:complete&&valid?'lexical+neural':'lexical-only',originalRank:index};
 }).sort((a,b)=>b.score-a.score||a.originalRank-b.originalRank).slice(0,limit);
}
