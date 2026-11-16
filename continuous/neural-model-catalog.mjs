/** Curated open-weight candidates. Metadata is not evidence of installation or availability. */
export const MODEL_CANDIDATES=Object.freeze([
 Object.freeze({id:'qwen3.5:4b',family:'Qwen3.5',task:'conversation',runtime:'ollama',minimumRamGb:8,license:'Apache-2.0',reference:'https://huggingface.co/collections/Qwen/qwen35',role:'mental',status:'candidate'}),
 Object.freeze({id:'qwen3.5:9b',family:'Qwen3.5',task:'conversation',runtime:'ollama',minimumRamGb:16,license:'Apache-2.0',reference:'https://huggingface.co/collections/Qwen/qwen35',role:'mental',status:'candidate'}),
 Object.freeze({id:'BAAI/bge-m3',family:'BGE-M3',task:'embedding',runtime:'sentence-transformers',minimumRamGb:4,license:'MIT',reference:'https://huggingface.co/BAAI/bge-m3',role:'memory',status:'candidate'}),
 Object.freeze({id:'microsoft/Phi-4-mini-instruct',family:'Phi-4-mini',task:'reasoning',runtime:'transformers',minimumRamGb:8,license:'MIT',reference:'https://huggingface.co/microsoft/Phi-4-mini-instruct',role:'review',status:'candidate'})
]);
const known=new Set(MODEL_CANDIDATES.map(model=>model.id));
/** Deterministic advisory only. No downloads, network, installations or inference. */
export function selectModelCandidates({task='conversation',ramGb=0,installed=[],allowDownloads=false}={}){
 if(!['conversation','embedding','reasoning'].includes(task)||!Number.isFinite(ramGb)||ramGb<0||!Array.isArray(installed))throw new TypeError('Invalid model selection');
 const installedSet=new Set(installed.filter(id=>typeof id==='string'&&known.has(id)));
 return MODEL_CANDIDATES.filter(model=>model.task===task&&model.minimumRamGb<=ramGb)
  .map(model=>({...model,available:installedSet.has(model.id),needsDownload:!installedSet.has(model.id),allowedToInstall:allowDownloads===true}))
  .sort((a,b)=>Number(b.available)-Number(a.available)||a.minimumRamGb-b.minimumRamGb);
}
