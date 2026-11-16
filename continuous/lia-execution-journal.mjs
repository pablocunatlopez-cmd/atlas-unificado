import {appendLiaTransitionJournal} from './lia-transition-journal.mjs';
/** Build a per-job journal only from known executed audit/tool checks.
 * No model-generated text is treated as proof of execution.
 */
export function journalLiaExecutedChecks(hypotheses,{timestamp=new Date().toISOString()}={}){
 if(!Array.isArray(hypotheses)||hypotheses.length>30)return [];
 let journal=[];
 for(const h of hypotheses){
  if(!h||!['citation-check','validated-tool-result'].includes(h.id)||!Array.isArray(h.evidence))continue;
  const evidence=h.evidence.find(e=>e?.type==='tool-output'&&e.verified===true&&typeof e.reference==='string');
  if(!evidence)continue;
  const kind=h.id==='citation-check'?'citation-audit':'deterministic-tool';
  const outcome=h.status==='supported'?'pass':h.status==='refuted'?'fail':'unknown';
  journal=appendLiaTransitionJournal(journal,{id:'check-'+journal.length,hypothesisId:h.id,timestamp,previousStatus:'testing',check:{executed:true,kind,outcome,reference:evidence.reference}});
 }
 return journal;
}
