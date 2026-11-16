/** Deterministic, CPU-only retrieval routing proposal.
 * This policy is a read-only recommendation, not permission to change the live engine.
 * Identifiers are checked before conceptual heuristics; ambiguity falls back to baseline.
 */
const IDENTIFIER=/\b(?:[A-Z]{1,8}[-_]?\d{2,12}|[A-Fa-f0-9]{16,64}|(?:ERR|RFC|HTTP)[-_ ]?\d{3,6})\b/;
const CONCEPT=/(?<![\p{L}\p{N}_])(?:why|how|compare|explain|relationship|difference|porque|por qué|cómo|compara|explica|relación|diferencia|significa|meaning|concepto|concept)(?![\p{L}\p{N}_])/iu;
export function proposeAtlasRetrievalRoute(question,{
 baseline='atlas-lexical',exact='fts5',semanticAvailable=false,semanticReviewed=false
}={}){
 if(typeof question!=='string'||!question.trim()||question.length>6000||
  !['atlas-lexical','fts5'].includes(baseline)||!['atlas-lexical','fts5'].includes(exact)||
  typeof semanticAvailable!=='boolean'||typeof semanticReviewed!=='boolean')
  throw new TypeError('Invalid retrieval routing inputs');
 const query=question.trim();
 const identifier=IDENTIFIER.test(query);
 const conceptual=CONCEPT.test(query);
 const route=identifier?'exact-identifier':conceptual?'conceptual':'ambiguous';
 // Semantic routing is advisory until an independently reviewed evaluation exists.
 const method=identifier?exact:baseline;
 const suggestedExperiment=conceptual&&semanticAvailable&&semanticReviewed?'semantic-candidate-review':null;
 return Object.freeze({route,method,reason:identifier?'explicit-identifier':conceptual?'conceptual-query-without-proven-semantic-advantage':'no-validated-route',
  suggestedExperiment,semanticExecuted:false,autoSwitch:false,requiresReview:true});
}
