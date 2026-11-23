import type {missionContext} from './baselines.ts';

type SharedContext=ReturnType<typeof missionContext>;
type PriorWork={id?:string;status?:string;proposal?:string;applied?:string;error?:string};
const INPUT_UNITS=16000; // Same UTF-16 content-length limit as cloud/groq.mjs; not tokens.
const SHARED_UNITS=10000; // Leave room for a normal full proposal and reviewer instructions.
const MIN_DOCUMENT_UNITS=256;

/** Fit data fields before serialization. Never cut JSON, a mission, a proposal or review rules.
 * History identity/status/errors survive: a rejected attempt must not become an accepted precedent.
 * Both stages start with the same inventory and evidence; any shorter excerpts are disclosed.
 */
export function missionMessages(system:string,shared:SharedContext,proposal?:unknown){
 const priorWork=structuredClone(shared.priorWork) as PriorWork[];
 const documents=shared.documents.map(document=>({...document}));
 const budget={unit:'UTF-16',historyUnitsRemoved:0,shortenedDocumentIds:[] as string[]};
 const data={...shared,priorWork,documents,contextBudget:budget,...(proposal===undefined?{}:{proposal})};
 const proposalUnits=proposal===undefined?0:JSON.stringify({proposal}).length-1;
 const limit=Math.min(SHARED_UNITS+proposalUnits,INPUT_UNITS-system.length);
 let content=JSON.stringify(data);
 while(content.length>limit){
  // Keep recent failure/receipt provenance, trimming only optional narrative details first.
  const history=priorWork.flatMap((item,index)=>(['proposal','applied'] as const).map(key=>({index,key,text:item[key]||''}))).sort((a,b)=>b.text.length-a.text.length)[0];
  if(history?.text.length){
   priorWork[history.index][history.key]=history.text.slice(0,Math.max(0,history.text.length-256));
   budget.historyUnitsRemoved+=Math.min(256,history.text.length);
  }else{
   const document=documents.filter(d=>d.text.length>MIN_DOCUMENT_UNITS).sort((a,b)=>b.text.length-a.text.length)[0];
   if(!document)throw Error('El contexto obligatorio de la misión y la propuesta supera el límite; no se ha enviado ni recortado.');
   let end=Math.max(MIN_DOCUMENT_UNITS,document.text.length-256);
   // Avoid manufacturing a lone surrogate at an excerpt boundary.
   if(/[\uD800-\uDBFF]/.test(document.text[end-1]))end--;
   document.text=document.text.slice(0,end);
   if(!budget.shortenedDocumentIds.includes(document.id))budget.shortenedDocumentIds.push(document.id);
  }
  content=JSON.stringify(data);
 }
 return [{role:'system' as const,content:system},{role:'user' as const,content}];
}
