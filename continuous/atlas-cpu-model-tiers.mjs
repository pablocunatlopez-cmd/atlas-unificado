/**
 * Small-model recommendations for CPU-only operation. Sizes are planning
 * estimates, not measured model weights or performance guarantees.
 */
export const ATLAS_CPU_MODEL_TIERS=Object.freeze([
 Object.freeze({id:'tiny',maxModelMb:500,contextTokens:1024,use:'minimal chat or speech recognition'}),
 Object.freeze({id:'small',maxModelMb:1600,contextTokens:2048,use:'basic local conversation'}),
 Object.freeze({id:'medium',maxModelMb:3500,contextTokens:2048,use:'stronger quantized local conversation'})
]);
export function recommendAtlasCpuModelTier({freeRamMb}={}){
 if(!Number.isSafeInteger(freeRamMb)||freeRamMb<0)
  throw Error('Invalid free RAM budget');
 const reserveMb=Math.max(512,Math.ceil(freeRamMb*0.25));
 const usableMb=Math.max(0,freeRamMb-reserveMb);
 const tier=[...ATLAS_CPU_MODEL_TIERS].reverse()
  .find(x=>x.maxModelMb+512<=usableMb)??null;
 return Object.freeze({freeRamMb,reserveMb,usableMb,
  tier:tier?.id??null,modelInstalled:false,
  benchmarked:false,status:tier?'candidate_only':'insufficient_ram'});
}
