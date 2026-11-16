/** Advisory CPU/12-GB VRAM workload planner; never launches a process. */
const TYPES=new Set(['chat','scene-3d','video','music','render','audio-master']);
export function planAtlasCreativeWorkload({type,estimatedVramGb=0,availableVramGb=0,cpuFallback=true,concurrentGpuJobs=0}={}){
 if(!TYPES.has(type)||![estimatedVramGb,availableVramGb].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1024)||
  typeof cpuFallback!=='boolean'||!Number.isInteger(concurrentGpuJobs)||concurrentGpuJobs<0||concurrentGpuJobs>100)
  throw new TypeError('Invalid creative workload');
 const gpuPossible=availableVramGb>0&&estimatedVramGb>0&&estimatedVramGb<=availableVramGb*.85&&concurrentGpuJobs===0;
 const mode=gpuPossible?'gpu':cpuFallback?'cpu-review':'blocked';
 const reason=gpuPossible?'estimated-fit-with-headroom':concurrentGpuJobs?'gpu-busy':availableVramGb===0?'gpu-unavailable':'estimated-vram-over-budget';
 return Object.freeze({type,mode,reason,estimatedVramGb,availableVramGb,headroomFactor:.85,
  hardwareMeasured:false,estimateOnly:true,queueRequired:concurrentGpuJobs>0,
  executionStarted:false,modelInstalled:false,performanceVerified:false,requiresUserReview:true});
}
