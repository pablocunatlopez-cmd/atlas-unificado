/**
 * Atlas multimodal model router. Capability metadata is declarative:
 * it does not install, download, load or execute third-party models.
 * License acceptance and benchmark results belong to a trusted host.
 */
export const ATLAS_NEURAL_BACKENDS=Object.freeze([
 {id:'llama-cpp',domain:'reasoning',tasks:['chat','code','vision'],runtime:'local',gpu:'optional',license:'MIT',source:'https://github.com/ggml-org/llama.cpp',status:'integration_required'},
 {id:'whisper-cpp',domain:'audio',tasks:['speech_to_text'],runtime:'local',gpu:'optional',license:'MIT',source:'https://github.com/ggml-org/whisper.cpp',status:'integration_required'},
 {id:'gsplat',domain:'3d',tasks:['scene_reconstruction'],runtime:'local',gpu:'cuda',license:'Apache-2.0',source:'https://github.com/nerfstudio-project/gsplat',status:'integration_required'},
 {id:'audiocraft',domain:'audio',tasks:['music_generation','sound_generation'],runtime:'local',gpu:'preferred',license:'code_MIT_weights_CC-BY-NC-4.0',source:'https://github.com/facebookresearch/audiocraft',status:'research_only'},
 {id:'demucs',domain:'audio',tasks:['source_separation'],runtime:'local',gpu:'optional',license:'MIT',source:'https://github.com/facebookresearch/demucs',status:'archived_research_only'}
]);
const TASKS=new Set(ATLAS_NEURAL_BACKENDS.flatMap(x=>x.tasks));
export function planAtlasNeuralTask({task,availableBackends=[],commercial=false,allowResearch=false,preferredGpu='optional'}={}){
 if(!TASKS.has(task)||!Array.isArray(availableBackends)||availableBackends.some(x=>typeof x!=='string'))
  throw Error('Invalid neural routing request');
 const available=new Set(availableBackends);
 const candidates=ATLAS_NEURAL_BACKENDS.filter(x=>x.tasks.includes(task)&&available.has(x.id))
  .map(x=>({...x,blockedReasons:[
    ...(x.status!=='integration_required'&&!allowResearch?['research_only']:[]),
    ...(commercial&&x.license.includes('NC')?['noncommercial_weights']:[]),
    ...(x.gpu==='cuda'&&preferredGpu==='cpu'?['requires_cuda']:[])
   ]}));
 const eligible=candidates.filter(x=>x.blockedReasons.length===0)
  .sort((a,b)=>Number(b.gpu===preferredGpu)-Number(a.gpu===preferredGpu)||a.id.localeCompare(b.id));
 return Object.freeze({task,candidates,selected:eligible[0]?.id??null,
  status:eligible.length?'requires_trusted_runtime_and_benchmark':'no_eligible_backend',
  executed:false,measured:false,promotionAuthorized:false});
}
