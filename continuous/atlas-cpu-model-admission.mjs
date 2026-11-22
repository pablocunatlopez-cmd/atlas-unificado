import {probeAtlasCpuHardware} from './atlas-cpu-hardware-probe.mjs';
import {planAtlasCpuWorkload} from './atlas-cpu-workload-planner.mjs';
/**
 * Conservative CPU admission check based on a fresh host memory snapshot.
 * No model is downloaded or started.
 */
export function planAtlasCpuModelAdmission({task='chat',modelSizeMb,
 contextTokens=2048,osApi}={}){
 const hardware=probeAtlasCpuHardware(osApi?{osApi}:undefined);
 const budget=planAtlasCpuWorkload({task,modelSizeMb,
  freeRamMb:hardware.freeRamMb,threads:hardware.recommendedThreads,contextTokens});
 return Object.freeze({hardware,budget,admitted:budget.accepted,
  reason:budget.accepted?'requires_runtime_validation':'insufficient_free_ram',
  executed:false});
}
