import {createHash} from 'node:crypto';
import {spawn as nodeSpawn} from 'node:child_process';
import {buildAtlasDockerInvocation} from './atlas-docker-invocation.mjs';

/**
 * Docker runner for an already host-verified immutable checkout.
 * The host must verify checkout SHA, canonical path, Docker daemon and image
 * provenance before invoking this function. This is NOT a security boundary.
 */
export async function runAtlasDockerPlan({plan,image,workspacePath,hostVerified=false,
 spawn=nodeSpawn,now=()=>Date.now()}={}){
 const invocation=buildAtlasDockerInvocation({plan,image,workspacePath});
 if(hostVerified!==true)throw Error('Trusted host verification required');
 const max=plan.limits.maxOutputBytes;
 if(!Number.isSafeInteger(max)||max<1024||max>1000000)throw Error('Invalid output budget');
 const started=now(),hash=createHash('sha256');let size=0,overflow=false,timedOut=false,terminationUnconfirmed=false;
 const chunks=[];
 const child=spawn(invocation.command,invocation.args,{shell:false,stdio:['ignore','pipe','pipe'],
  env:{PATH:process.env.PATH||'/usr/bin:/bin'}});
 if(!child||typeof child.once!=='function'||!child.stdout||!child.stderr||
  typeof child.kill!=='function')throw Error('Invalid process adapter');
 const collect=chunk=>{
  const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  if(overflow)return;
  size+=bytes.length;
  if(size>max){overflow=true;child.kill('SIGKILL');return;}
  hash.update(bytes);chunks.push(bytes);
 };
 child.stdout.on('data',collect);child.stderr.on('data',collect);
 const result=await new Promise(resolve=>{
  let settled=false;
  let grace;
  const finish=(code,signal,error)=>{
   if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);resolve({code,signal,error});
  };
  const timer=setTimeout(()=>{
   timedOut=true;
   try{child.kill('SIGKILL');}catch{}
   // A failed kill must not leave Atlas waiting forever. This is NOT proof
   // that the container or its descendants have actually stopped.
   grace=setTimeout(()=>{terminationUnconfirmed=true;finish(null,null,Error('Process termination unconfirmed'));},1000);
  },plan.limits.timeoutMs);
  child.once('error',error=>finish(null,null,error));
  child.once('close',(code,signal)=>finish(code,signal,null));
 });
 const completedAt=now();
 return Object.freeze({
  schemaVersion:1,proposalId:plan.proposalId,commitSha:plan.commitSha,
  image,mode:plan.mode,exitCode:result.code,signal:result.signal,
  passed:result.code===0&&!result.error&&!timedOut&&!overflow&&!terminationUnconfirmed,
  timedOut,terminationUnconfirmed,outputOverflow:overflow,outputBytes:size,outputSha256:overflow?null:hash.digest('hex'),
  output:Buffer.concat(chunks).toString('utf8').slice(0,max),
  durationMs:Math.max(0,completedAt-started),
  status:terminationUnconfirmed?'termination_unconfirmed':timedOut?'timeout':overflow?'output_limit':result.error?'process_error':result.code===0?'passed':'failed',
  // The caller must bind this report to a trusted checkout attestation.
  attested:false,promotionAuthorized:false
 });
}
