/**
 * Build an isolated Docker invocation for a preverified, immutable workspace.
 * This builds arguments only: it neither executes Docker nor verifies host mounts.
 * The trusted host MUST validate that workspacePath is a read-only, canonical,
 * symlink-free checkout of plan.commitSha and that Docker is safely configured.
 */
const SHA=/^[a-f0-9]{40}$/i;
const IMAGE=/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/;
const ROOT=/^\/[a-zA-Z0-9_./-]{1,500}$/;
const MODES={syntax:['node','scripts/check-syntax.mjs'],unit:['npm','test'],integration:['npm','test']};
export function buildAtlasDockerInvocation({plan,image,workspacePath}={}){
 if(!plan||plan.status!=='requires_trusted_isolated_executor'||
    plan.executionAuthorized!==false||!SHA.test(plan.commitSha||'')||
    !IMAGE.test(image||'')||!ROOT.test(workspacePath||'')||
    workspacePath.split('/').some((part,i)=>i>0&&(!part||part==='.'||part==='..'))||
    !Object.hasOwn(MODES,plan.mode)||
    !Number.isSafeInteger(plan.limits?.memoryMb)||
    plan.limits.memoryMb<64||plan.limits.memoryMb>4096||
    !Number.isSafeInteger(plan.limits?.timeoutMs)||
    plan.limits.timeoutMs<1000||plan.limits.timeoutMs>300000)
  throw Error('Invalid trusted Docker invocation');
 const args=['run','--rm','--pull=never','--network=none',
  '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
  '--pids-limit=64','--memory='+plan.limits.memoryMb+'m',
  '--memory-swap='+plan.limits.memoryMb+'m','--cpus=1',
  '--user=65534:65534','--workdir=/workspace',
  '--mount=type=bind,src='+workspacePath+',dst=/workspace,readonly',
  '--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m',
  '--env=HOME=/tmp','--env=CI=1',image,...MODES[plan.mode]];
 return Object.freeze({command:'docker',args,requiresHostVerification:true,
  execute:false,commitSha:plan.commitSha,proposalId:plan.proposalId});
}
