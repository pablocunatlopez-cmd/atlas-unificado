/**
 * Atlas evidence verification boundary.
 * A trusted host supplies verifyEvidence, which must check signatures,
 * principal, expiry, commit digest and CI provenance outside this module.
 * Never accept caller-provided "verified" flags as proof.
 */
const SHA=/^[a-f0-9]{40}$/i;
const CHECKS=['syntax','unit','security'];
export async function evaluateAtlasVerifiedChange({
 proposalId,commitSha,actions=[],evidence=[],verifyEvidence
}={}){
 if(typeof proposalId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(proposalId)||
    typeof commitSha!=='string'||!SHA.test(commitSha)||
    !Array.isArray(actions)||!Array.isArray(evidence)||evidence.length>30||
    typeof verifyEvidence!=='function')throw Error('Invalid evidence evaluation');
 const kinds=new Set(['read','analyze','plan','test','write','execute','network','publish','delete']);
 const sensitive=new Set(['write','execute','network','publish','delete']);
 let requiresApproval=false;
 for(const action of actions){
  if(!action||!kinds.has(action.kind)||typeof action.target!=='string'||!action.target||
     action.target.length>250)throw Error('Invalid action');
  if(sensitive.has(action.kind))requiresApproval=true;
 }
 const accepted=new Set();
 for(const item of evidence){
  if(!item||typeof item!=='object'||!['syntax','unit','security','approval'].includes(item.kind))
   throw Error('Invalid evidence');
  // The verifier is a trusted host dependency, never a model-supplied function.
  const verified=await verifyEvidence(item,{proposalId,commitSha,actions});
  if(verified===true)accepted.add(item.kind);
 }
 const missing=CHECKS.filter(x=>!accepted.has(x));
 if(requiresApproval&&!accepted.has('approval'))missing.push('approval');
 return Object.freeze({
  proposalId,commitSha,requiresApproval,
  verifiedChecks:CHECKS.filter(x=>accepted.has(x)),
  missingEvidence:missing,
  readyForHumanReview:missing.length===0,
  executionAuthorized:false,
  status:'evidence_review_only',
 });
}
