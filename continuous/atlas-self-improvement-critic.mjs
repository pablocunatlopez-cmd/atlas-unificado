/**
 * LOR-Omega dry-run critic: reviews declared candidate tradeoffs only.
 * It neither runs generated code nor grants permission to apply it.
 */
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
export function critiqueAtlasSelfImprovement(plan,{rejectedHistory=[]}={}){
 if(!plan||plan.schemaVersion!==1||plan.mode!=='dry_run'||
    !Array.isArray(plan.proposals)||plan.proposals.length>20||
    !Array.isArray(rejectedHistory)||rejectedHistory.length>200)
  throw Error('Invalid dry-run plan or negative memory');
 const rejected=new Set(rejectedHistory.map(item=>{
  if(typeof item!=='string'||item.length>1000)throw Error('Invalid rejection memory');
  return item;
 }));
 const reviews=plan.proposals.map(p=>{
  if(!p||!ID.test(p.id||'')||!Array.isArray(p.candidates)||
     p.candidates.length<2||p.candidates.length>5||
     p.status!=='proposal_only'||p.codeExecuted!==false||
     p.patchApplied!==false||p.requiresHumanApproval!==true)
   throw Error('Invalid or unsafe proposal');
  const candidates=p.candidates.map(c=>{
   if(!c||typeof c.description!=='string'||!c.description.trim()||
      typeof c.risk!=='string'||!c.risk.trim()||
      typeof c.acceptanceCriterion!=='string'||!c.acceptanceCriterion.trim()||
      !Number.isInteger(c.estimatedBenefit)||c.estimatedBenefit<0||
      c.estimatedBenefit>5||!Number.isInteger(c.estimatedRisk)||
      c.estimatedRisk<0||c.estimatedRisk>5)
    throw Error('Malformed candidate');
   const concerns=[];
   if(rejected.has(c.description))concerns.push('previously_rejected_candidate');
   if(c.estimatedRisk>=c.estimatedBenefit)concerns.push('risk_not_below_estimated_benefit');
   if(c.estimatedRisk>=4)concerns.push('high_estimated_risk');
   return Object.freeze({description:c.description,concerns:Object.freeze(concerns),
    disposition:concerns.length?'requires_revision':'requires_independent_validation'});
  });
  const needsRevision=candidates.every(c=>c.disposition==='requires_revision');
  return Object.freeze({proposalId:p.id,candidates:Object.freeze(candidates),
   disposition:needsRevision?'revise_all_candidates':'human_review_required',
   codeExecuted:false,patchApplied:false,authorizationGranted:false,
   critiqueLimit:'Heuristic review of supplied estimates; not independent verification'});
 });
 if(new Set(reviews.map(r=>r.proposalId)).size!==reviews.length)
  throw Error('Duplicate proposal ID');
 return Object.freeze({schemaVersion:1,mode:'dry_run',reviews:Object.freeze(reviews),
  codeExecuted:false,patchApplied:false,authorizationGranted:false});
}
