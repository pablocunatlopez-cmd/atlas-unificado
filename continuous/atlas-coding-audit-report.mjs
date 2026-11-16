/**
 * Redacted audit report builder. Inputs are observations, not proof.
 * Never includes patch contents, signatures, credentials, or raw tokens.
 */
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const STATUS=new Set(['planned','review_blocked','intent_recorded',
 'outcome_unknown','host_reported_committed','manual_review_required']);
export function buildAtlasCodingAuditReport({proposalId,transactionId,
 observations=[]}={}){
 if(!ID.test(proposalId||'')||!ID.test(transactionId||'')||
    !Array.isArray(observations)||observations.length>500)
  throw Error('Invalid coding audit report');
 const events=observations.map((event,index)=>{
  if(!event||!STATUS.has(event.status)||!Number.isSafeInteger(event.atMs)||
     event.atMs<0||!['host','planner','recovery'].includes(event.source))
   throw Error('Invalid audit observation');
  return Object.freeze({index,atMs:event.atMs,status:event.status,
   source:event.source,trust:event.source==='host'?'host_reported_unverified':
    'local_observation_unverified'});
 });
 const needsHumanReview=events.some(x=>['review_blocked','outcome_unknown',
  'manual_review_required'].includes(x.status));
 return Object.freeze({schemaVersion:1,proposalId,transactionId,
  events:Object.freeze(events),needsHumanReview,
  authorizationGranted:false,
  note:'Audit observations are not cryptographic evidence of authorization or commit'});
}
