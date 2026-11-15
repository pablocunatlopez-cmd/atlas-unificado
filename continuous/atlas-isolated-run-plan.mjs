/**
 * Bounded execution plan. A trusted host must implement the actual isolation.
 * This module never spawns a process or treats its own plan as proof of safety.
 */
const MODES=new Set(['syntax','unit','integration']);
const PATH=/^[A-Za-z0-9_.\/-]{1,240}$/;
const validPath=p=>typeof p==='string'&&PATH.test(p)&&!p.startsWith('/')&&
 p.split('/').every(x=>x&&x!=='.'&&x!=='..')&&
 !p.startsWith('.git/')&&p!=='.git'&&!p.startsWith('node_modules/')&&p!=='node_modules';
export function planAtlasIsolatedRun({commitSha,proposalId,mode='unit',files=[],limits={}}={}){
 if(typeof commitSha!=='string'||!/^[a-f0-9]{40}$/i.test(commitSha)||
    typeof proposalId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(proposalId)||
    !MODES.has(mode)||!Array.isArray(files)||files.length>100||
    files.some(x=>!validPath(x))||new Set(files).size!==files.length)
  throw Error('Invalid isolated run request');
 const {timeoutMs=60000,memoryMb=512,maxOutputBytes=200000}=limits;
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000||
    !Number.isSafeInteger(memoryMb)||memoryMb<64||memoryMb>4096||
    !Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1024||maxOutputBytes>1000000)
  throw Error('Invalid execution limits');
 return Object.freeze({
  schemaVersion:1,commitSha,proposalId,mode,files:[...files].sort(),
  limits:{timeoutMs,memoryMb,maxOutputBytes},
  requirements:{
   immutableCommitCheckout:true,ephemeralFilesystem:true,readOnlyRoot:true,
   network:'disabled',privileged:false,hostSecrets:'none',
   enforceProcessTreeTermination:true,verifyArtifactDigest:true
  },
  status:'requires_trusted_isolated_executor',executionAuthorized:false
 });
}
