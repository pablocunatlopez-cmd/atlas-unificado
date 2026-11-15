import {recommendAtlasCpuModelTier} from './atlas-cpu-model-tiers.mjs';
/**
 * Conservative memory pressure decision. Never unloads a model automatically.
 * Host must explicitly apply any proposed downgrade.
 */
export function decideAtlasCpuMemoryPressure({
 freeRamMb,currentTier='small',minimumFreeMb=1024
}={}){
 if(!Number.isSafeInteger(freeRamMb)||freeRamMb<0||
  !Number.isSafeInteger(minimumFreeMb)||minimumFreeMb<256||
  minimumFreeMb>16384||!['tiny','small','medium'].includes(currentTier))
  throw Error('Invalid CPU memory pressure inputs');
 const candidate=recommendAtlasCpuModelTier({freeRamMb});
 const rank={tiny:0,small:1,medium:2};
 const lowMemory=freeRamMb<minimumFreeMb;
 const downgrade=lowMemory||candidate.tier===null||
  rank[candidate.tier]<rank[currentTier];
 return Object.freeze({freeRamMb,currentTier,lowMemory,
  action:downgrade?'recommend_downgrade':'keep',
  suggestedTier:downgrade?(candidate.tier&&rank[candidate.tier]<rank[currentTier]?
   candidate.tier:null):currentTier,
  automaticSwitch:false,requiresHostApproval:downgrade});
}
