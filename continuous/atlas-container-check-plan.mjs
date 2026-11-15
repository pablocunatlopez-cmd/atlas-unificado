import {planAtlasIsolatedChecks} from './atlas-isolated-check-policy.mjs';
/**
 * Generate a deterministic Docker/Podman argv for a separately trusted host.
 * Never starts a container. Requires a pre-provisioned, pinned local image.
 * No shell interpolation, network, capabilities, writable root or host secrets.
 */
const IMAGE=/^[a-z0-9][a-z0-9._/-]{0,180}@sha256:[a-f0-9]{64}$/;
const SAFE_PATH=/^\/[a-zA-Z0-9_.\/-]{1,240}$/;
export function planAtlasContainerChecks({
 workspacePath,imageDigest,checks=['node --test'],
 cpuSeconds=15,memoryMb=512,runtime='podman'
}={}){
 const policy=planAtlasIsolatedChecks({checks,cpuSeconds,memoryMb});
 if(!['podman','docker'].includes(runtime)||
  typeof workspacePath!=='string'||!SAFE_PATH.test(workspacePath)||
  workspacePath.split('/').some(x=>x==='..'||x==='.')||workspacePath.includes('//')||
  typeof imageDigest!=='string'||!IMAGE.test(imageDigest))
  throw Error('Invalid isolated container inputs');
 const command=checks[0]==='node --check'
  ?['node','--check','/workspace/entry.mjs']
  :['node','--test'];
 return Object.freeze({
  runtime,argv:Object.freeze([
   'run','--rm','--network=none','--read-only',
   '--cap-drop=ALL','--security-opt=no-new-privileges',
   '--pids-limit=64','--memory='+memoryMb+'m',
   '--cpus=1','--user=65534:65534',
   '--mount','type=bind,src='+workspacePath+',dst=/workspace,readonly',
   '--workdir=/workspace','--tmpfs','/tmp:rw,noexec,nosuid,size=32m',
   '--env','HOME=/tmp','--entrypoint','/usr/local/bin/node',
   imageDigest,...command.slice(1)
  ]),
  imageDigest,policy,executed:false,
  note:'Host must verify image provenance, rootless runtime and actual isolation; CPU seconds require external timeout'
 });
}
