import {createHash} from 'node:crypto';
import {materializeAtlasPatchWorkspace} from './atlas-temporary-patch-workspace.mjs';
import {planAtlasContainerChecks} from './atlas-container-check-plan.mjs';
import {runAtlasContainerCheck} from './atlas-container-check-runner.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/**
 * Explicitly requested, bounded local test cycle. Host supplies a trusted
 * digest-pinned image and runtime; this module cannot attest OS isolation.
 * Never merges, publishes or modifies the original repository.
 */
export async function runAtlasReviewedPatchCycle({
 proposal,currentRevision,snapshot,imageDigest,runtime='podman',
 checks=['node --test'],timeoutMs=30000,spawn,
 materialize=materializeAtlasPatchWorkspace,
 runCheck=runAtlasContainerCheck
}={}){
 if(typeof materialize!=='function'||typeof runCheck!=='function'||
  !Array.isArray(checks)||checks.length!==1)
  throw Error('Invalid reviewed patch cycle');
 let workspace;
 try{
  workspace=await materialize({proposal,currentRevision,snapshot});
  const plan=planAtlasContainerChecks({
   workspacePath:workspace.root,imageDigest,runtime,checks
  });
  const execution=await runCheck({
   plan,timeoutMs,...(spawn?{spawn}:{})
  });
  if(!execution||!['passed','failed'].includes(execution.status)||
   execution.executed!==true)
   throw Error('Invalid test execution evidence');
  const evidence={
   proposalId:proposal.proposalId,baseRevision:currentRevision,
   manifestHash:proposal.manifestHash,
   imageDigest,commands:checks,changes:workspace.changes,
   testStatus:execution.status,exitCode:execution.exitCode,
   timedOut:execution.timedOut,outputTruncated:execution.outputTruncated,
   stdout:execution.stdout,stderr:execution.stderr,
   sandboxAttested:false
  };
  return Object.freeze({
   status:execution.status==='passed'?'tests_reported_passed':'tests_reported_failed',
   evidence:Object.freeze({...evidence,evidenceHash:digest(evidence)}),
   source:'host_runner_report_not_independently_attested',
   requiresHumanReview:true,readyToMerge:false,
   originalRepositoryModified:false
  });
 }finally{
  if(workspace)await workspace.cleanup();
 }
}
