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
 const started=now(),hash=createHash('sha256');let size=0,overflow=false,timedOut=false;
 const chunks=[];
 const child=spawn(invocation.command,invocation.args,{shell:false,stdio:['ignore','pipe','pipe'],
  env:{PATH:process.env.PATH||'/usr/bin:/bin'}});
 if(!child||typeof child.once!=='function'||!child.stdout||!child.stderr||
  typeof child.kill!=='function')throw Error('Invalid process adapter');
 const collect=chunk=>{
  const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  hash.update(bytes);size+=bytes.length;
  if(size<=max)chunks.push(bytes);
  else {overflow=true;child.kill('SIGKILL');}
 };
 child.stdout.on('data',collect);child.stderr.on('data',collect);
 const result=await new Promise(resolve=>{
  let settled=false;
  const finish=(code,signal,error)=>{
   if(settled)return;settled=true;clearTimeout(timer);resolve({code,signal,error});
  };
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},plan.limits.timeoutMs);
  child.once('error',error=>finish(null,null,error));
  child.once('close',(code,signal)=>finish(code,signal,null));
 });
 const completedAt=now();
 return Object.freeze({
  schemaVersion:1,proposalId:plan.proposalId,commitSha:plan.commitSha,
  image,mode:plan.mode,exitCode:result.code,signal:result.signal,
  passed:result.code===0&&!result.error&&!timedOut&&!overflow,
  timedOut,outputOverflow:overflow,outputBytes:size,outputSha256:hash.digest('hex'),
  output:Buffer.concat(chunks).toString('utf8').slice(0,max),
  durationMs:Math.max(0,completedAt-started),
  status:result.error?'process_error':timedOut?'timeout':overflow?'output_limit':result.code===0?'passed':'failed',
  // The caller must bind this report to a trusted checkout attestation.
  attested:false,promotionAuthorized:false
 });
}
