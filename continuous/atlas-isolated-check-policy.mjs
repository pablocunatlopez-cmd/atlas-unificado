/**
 * A fail-closed execution policy for a separate trusted OS sandbox runner.
 * This module DOES NOT run commands or provide OS isolation itself.
 */
const ALLOWED=new Set(['node --check','node --test']);
export function planAtlasIsolatedChecks({
 checks=['node --check'],cpuSeconds=15,memoryMb=512,
 network=false,workspaceReadOnly=true
}={}){
 if(!Array.isArray(checks)||checks.length===0||checks.length>20||
  checks.some(x=>typeof x!=='string'||!ALLOWED.has(x))||
  !Number.isSafeInteger(cpuSeconds)||cpuSeconds<1||cpuSeconds>120||
  !Number.isSafeInteger(memoryMb)||memoryMb<64||memoryMb>2048||
  network!==false||workspaceReadOnly!==true)
  throw Error('Unsafe isolated check request');
 return Object.freeze({
  status:'requires_external_os_sandbox',
  commands:Object.freeze([...checks]),
  cpuSeconds,memoryMb,network:false,workspaceReadOnly:true,
  envAllowlist:Object.freeze(['PATH','LANG','LC_ALL']),
  secretsAllowed:false,hostFilesystemAllowed:false,
  executable:false,checksExecuted:false,
  requiredBoundary:'rootless container or equivalent isolated worker with no network and strict resource limits'
 });
}
