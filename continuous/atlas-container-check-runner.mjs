import {spawn as nodeSpawn} from 'node:child_process';
import {planAtlasContainerChecks} from './atlas-container-check-plan.mjs';
/**
 * Runs only an already validated container argv, through a host-controlled
 * runtime. Does not attest that the runtime is rootless or secure.
 * Use only with a trusted pinned image and an authorized disposable workspace.
 */
export async function runAtlasContainerCheck({
 plan,spawn=nodeSpawn,timeoutMs=30000,maxOutputBytes=65536
}={}){
 if(!plan||plan.executed!==false||!['podman','docker'].includes(plan.runtime)||
  !Array.isArray(plan.argv)||plan.argv[0]!=='run'||
  !plan.argv.includes('--network=none')||
  !plan.argv.includes('--read-only')||
  !plan.argv.includes('--cap-drop=ALL')||
  !plan.argv.includes('--security-opt=no-new-privileges')||
  typeof spawn!=='function'||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000||
  !Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1024||maxOutputBytes>1048576)
  throw Error('Invalid container execution plan');
 const mount=plan.argv[plan.argv.indexOf('--mount')+1];
 const match=typeof mount==='string'?/^type=bind,src=(\/[^,]+),dst=\/workspace,readonly$/.exec(mount):null;
 if(!match)throw Error('Invalid workspace mount');
 const expected=planAtlasContainerChecks({workspacePath:match[1],imageDigest:plan.imageDigest,
  checks:plan.policy?.commands,cpuSeconds:plan.policy?.cpuSeconds,
  memoryMb:plan.policy?.memoryMb,runtime:plan.runtime});
 if(JSON.stringify(plan.argv)!==JSON.stringify(expected.argv))
  throw Error('Container arguments not trusted');
 return new Promise((resolve,reject)=>{
  let child,output='',errorOutput='',finished=false,timedOut=false,overflow=false;
  const settle=(err,value)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   if(err)reject(err);else resolve(Object.freeze(value));
  };
  try{
   child=spawn(plan.runtime,plan.argv,{
    shell:false,env:{PATH:process.env.PATH??'/usr/bin:/bin'},
    stdio:['ignore','pipe','pipe'],windowsHide:true
   });
  }catch(err){reject(err);return;}
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
  const capture=(chunk,stderr)=>{
   const str=chunk.toString('utf8');
   if(Buffer.byteLength(output+errorOutput+str)>maxOutputBytes){
    overflow=true;child.kill('SIGKILL');return;
   }
   if(stderr)errorOutput+=str;else output+=str;
  };
  child.stdout?.on('data',chunk=>capture(chunk,false));
  child.stderr?.on('data',chunk=>capture(chunk,true));
  child.on('error',err=>settle(err));
  child.on('close',(code,signal)=>settle(null,{
   status:!timedOut&&!overflow&&code===0?'passed':'failed',
   exitCode:code,signal,timedOut,outputTruncated:overflow,
   stdout:output,stderr:errorOutput,executed:true,
   sandboxAttested:false,requiresHumanReview:true
  }));
 });
}
