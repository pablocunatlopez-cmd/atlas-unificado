import {checkAtlasLocalLlamaHealth} from './atlas-local-llama-health.mjs';
import {decideAtlasCpuMemoryPressure} from './atlas-cpu-memory-pressure.mjs';
/**
 * Passive readiness snapshot for a CPU-only Atlas host.
 * It does not start servers, load models, or alter machine settings.
 */
export async function diagnoseAtlasLocalCpu({
 endpoint='http://127.0.0.1:8080',fetchImpl,
 freeRamMb,currentTier='small',minimumFreeMb=1024
}={}){
 if(!Number.isSafeInteger(freeRamMb)||freeRamMb<0)
  throw Error('Host free RAM reading required');
 const memory=decideAtlasCpuMemoryPressure({freeRamMb,currentTier,minimumFreeMb});
 const llama=await checkAtlasLocalLlamaHealth({endpoint,fetchImpl});
 const ready=llama.ready&&memory.action==='keep';
 return Object.freeze({
  status:ready?'candidate_ready':llama.ready?'memory_attention':'server_attention',
  llama,memory,readyForRealInference:ready,
  inferenceTested:false,whisperTested:false,modelLoadedVerified:false,
  changesApplied:false
 });
}
