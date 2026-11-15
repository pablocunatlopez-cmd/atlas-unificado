/**
 * Atlas evidence verification boundary.
 * A trusted host supplies verifyEvidence, which must check signatures,
 * principal, expiry, commit digest and CI provenance outside this module.
 * Never accept caller-provided "verified" flags as proof.
 */
const SHA=/^[a-f0-9]{40}$/i;
const DIGEST=/^[a-f0-9]{64}$/i;
const CHECKS=['syntax','unit','security'];
function snapshotEvidence(evidence){
 const snapshot=structuredClone(evidence);
 const seen=new Set();
 function check(value){
  if(!value||typeof value!=='object'||seen.has(value))return;
  seen.add(value);
  if(typeof SharedArrayBuffer!=='undefined'&&value instanceof SharedArrayBuffer)
   throw Error('Shared evidence memory is not supported');
  if(ArrayBuffer.isView(value)){check(value.buffer);return;}
  if(value instanceof Map){
   for(const [key,item] of value){check(key);check(item);}
  }else if(value instanceof Set){
   for(const item of value)check(item);
  }
  for(const key of Reflect.ownKeys(value))check(value[key]);
 }
 check(snapshot);
 return snapshot;
}
export async function evaluateAtlasVerifiedChange({
 proposalId,commitSha,proposalDigest,actions=[],evidence=[],verifyEvidence
}={}){
 if(typeof proposalId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(proposalId)||
    typeof commitSha!=='string'||!SHA.test(commitSha)||
    (proposalDigest!==undefined&&(typeof proposalDigest!=='string'||!DIGEST.test(proposalDigest)))||
    !Array.isArray(actions)||!Array.isArray(evidence)||evidence.length>30||
    typeof verifyEvidence!=='function')throw Error('Invalid evidence evaluation');
 const kinds=new Set(['read','analyze','plan','test','write','execute','network','publish','delete']);
 const sensitive=new Set(['write','execute','network','publish','delete']);
 let requiresApproval=false;
 const verifiedActions=[];
 for(const action of actions){
  if(!action||!kinds.has(action.kind)||typeof action.target!=='string'||!action.target||
     action.target.length>250)throw Error('Invalid action');
  if(sensitive.has(action.kind))requiresApproval=true;
  verifiedActions.push(Object.freeze({kind:action.kind,target:action.target}));
 }
 const context=Object.freeze({
  proposalId,commitSha,...(proposalDigest===undefined?{}:{proposalDigest}),
  actions:Object.freeze(verifiedActions)
 });
 const accepted=new Set();
 const capturedEvidence=snapshotEvidence(evidence);
 for(const item of capturedEvidence){
  if(!item||typeof item!=='object'||!['syntax','unit','security','approval'].includes(item.kind))
   throw Error('Invalid evidence');
  // The verifier is a trusted host dependency, never a model-supplied function.
  const kind=item.kind;
  const verified=await verifyEvidence(item,context);
  if(verified===true)accepted.add(kind);
 }
 const missing=CHECKS.filter(x=>!accepted.has(x));
 if(requiresApproval&&!accepted.has('approval'))missing.push('approval');
 return Object.freeze({
  proposalId,commitSha,...(proposalDigest===undefined?{}:{proposalDigest}),requiresApproval,
  verifiedChecks:CHECKS.filter(x=>accepted.has(x)),
  missingEvidence:missing,
  readyForHumanReview:missing.length===0,
  executionAuthorized:false,
  status:'evidence_review_only',
 });
}
