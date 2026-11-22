import {reconcileAtlasCodingIntent} from './atlas-coding-intent-reconcile.mjs';
import {buildAtlasCodingAuditReport} from './atlas-coding-audit-report.mjs';
/**
 * Read-only audit projection from a private durable intent marker.
 * The caller supplies a trusted repository HEAD reader; the result
 * deliberately does not infer that any patch was committed.
 */
export async function auditAtlasCodingTransaction({directory,transactionId,
 proposalId,readHeadCommit,atMs,expectedBaseCommit,expectedDiffDigest}={}){
 if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expectedBaseCommit||'')||
    !/^[a-f0-9]{64}$/.test(expectedDiffDigest||''))
  throw Error('Trusted expected commit and patch digest required');
 if(!Number.isSafeInteger(atMs)||atMs<0)
  throw Error('Trusted audit observation time required');
 const recovery=await reconcileAtlasCodingIntent({directory,transactionId,readHeadCommit,expectedProposalId:proposalId,expectedBaseCommit,expectedDiffDigest});
 const status=recovery.status==='base_still_visible'?'intent_recorded':
  'manual_review_required';
 const report=buildAtlasCodingAuditReport({proposalId,transactionId,
  observations:[{atMs,status,source:'recovery'}]});
 return Object.freeze({...report,reconciliationStatus:recovery.status,
  recoveryAction:recovery.action,retrySafe:false,authorizationGranted:false});
}
