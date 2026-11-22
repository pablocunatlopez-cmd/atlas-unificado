/**
 * CPU-first admission planner. No hardware measurements are invented.
 * The host must probe real free RAM, available threads and installed models.
 */
export function planAtlasCpuWorkload({task,modelSizeMb,freeRamMb,threads=2,contextTokens=2048}={}){
 if(!['chat','code','speech_to_text','source_separation','spatial_audio','interactive_3d'].includes(task)||
  !Number.isSafeInteger(modelSizeMb)||modelSizeMb<0||
  !Number.isSafeInteger(freeRamMb)||freeRamMb<0||
  !Number.isSafeInteger(threads)||threads<1||threads>128||
  !Number.isSafeInteger(contextTokens)||contextTokens<128||contextTokens>32768)
  throw Error('Invalid CPU workload budget');
 // Conservative estimate: runtime overhead + KV cache reserve.
 const reserveMb=Math.max(512,Math.ceil(modelSizeMb*0.4)+Math.ceil(contextTokens/4));
 const requiredMb=modelSizeMb+reserveMb;
 const accepted=requiredMb<=freeRamMb;
 return Object.freeze({
  task,device:'cpu',gpuRequired:false,threads,contextTokens,
  modelSizeMb,freeRamMb,requiredMb,reserveMb,accepted,
  status:accepted?'requires_runtime_probe_and_benchmark':'insufficient_free_ram',
  measured:false,executed:false
 });
}
