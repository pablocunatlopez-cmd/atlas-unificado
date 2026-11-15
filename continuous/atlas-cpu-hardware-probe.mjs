import os from 'node:os';
/**
 * CPU hardware snapshot. OS-reported free memory is not a promise of
 * allocatable RAM; benchmarks and runtime admission remain mandatory.
 */
export function probeAtlasCpuHardware({osApi=os}={}){
 const totalRamBytes=osApi.totalmem(),freeRamBytes=osApi.freemem();
 const cpus=osApi.cpus();
 if(!Number.isFinite(totalRamBytes)||!Number.isFinite(freeRamBytes)||
  totalRamBytes<=0||freeRamBytes<0||freeRamBytes>totalRamBytes||
  !Array.isArray(cpus)||cpus.length<1)throw Error('Invalid CPU hardware probe');
 const toMb=n=>Math.floor(n/1048576);
 return Object.freeze({
  device:'cpu',logicalCores:cpus.length,
  totalRamMb:toMb(totalRamBytes),freeRamMb:toMb(freeRamBytes),
  recommendedThreads:Math.max(1,Math.min(4,cpus.length-1||1)),
  gpuAvailable:'unverified',source:'node:os',
  note:'OS snapshot only; available memory may change before inference'
 });
}
