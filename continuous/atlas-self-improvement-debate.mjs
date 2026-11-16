/**
 * LOR Omega dialectic: structured proponent and adversary positions.
 * Both are caller-supplied, untrusted arguments; this module does not
 * independently reason, invoke a model, execute code, or approve changes.
 */
const TEXT=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const SID=/^[A-Za-z0-9_-]{1,100}$/;
export function debateAtlasImprovement({proposal,proponent,adversary}={}){
 if(!proposal||!SID.test(proposal.id||'')||
    !proponent||!adversary||!TEXT(proponent.thesis,1500)||
    !TEXT(proponent.evidenceReference,300)||
    !TEXT(adversary.counterargument,1500)||
    !TEXT(adversary.evidenceReference,300)||
    !Array.isArray(adversary.objections)||adversary.objections.length>10||
    !Array.isArray(proponent.responses)||proponent.responses.length>10)
  throw Error('Malformed bounded debate');
 const objections=adversary.objections.map(o=>{
  if(!o||!SID.test(o.id||'')||!TEXT(o.claim,1000)||
     !TEXT(o.evidenceReference,300))throw Error('Invalid objection');
  return Object.freeze({id:o.id,claim:o.claim,evidenceReference:o.evidenceReference});
 });
 if(new Set(objections.map(x=>x.id)).size!==objections.length)
  throw Error('Duplicate objection ID');
 const responses=proponent.responses.map(r=>{
  if(!r||!SID.test(r.objectionId||'')||!TEXT(r.reply,1000)||
     !TEXT(r.evidenceReference,300)||!objections.some(o=>o.id===r.objectionId))
   throw Error('Invalid response');
  return Object.freeze({objectionId:r.objectionId,reply:r.reply,
   evidenceReference:r.evidenceReference});
 });
 if(new Set(responses.map(r=>r.objectionId)).size!==responses.length)
  throw Error('Duplicate response');
 const answered=new Set(responses.map(r=>r.objectionId));
 const unresolved=objections.filter(o=>!answered.has(o.id)).map(o=>o.id);
 const verdict=unresolved.length?'unresolved_objections':'arguments_recorded_not_verified';
 return Object.freeze({schemaVersion:1,mode:'dry_run',proposalId:proposal.id,
  proponent:Object.freeze({thesis:proponent.thesis,evidenceReference:proponent.evidenceReference}),
  adversary:Object.freeze({counterargument:adversary.counterargument,
   evidenceReference:adversary.evidenceReference}),
  objections:Object.freeze(objections),responses:Object.freeze(responses),
  unresolvedObjectionIds:Object.freeze(unresolved),verdict,
  codeExecuted:false,patchApplied:false,authorizationGranted:false,
  note:'A response does not prove an objection false; evidence references are not verified here'});
}
