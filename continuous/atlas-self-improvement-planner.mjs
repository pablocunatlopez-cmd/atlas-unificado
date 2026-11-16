/**
 * ATLAS-SELF-001: declarative self-improvement planner.
 * Pure data transformation: no filesystem, network, shell, eval, patch application
 * or automatic approval. The host must supply grounded observations.
 */
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const ALLOWED=new Set(['reliability','security','correctness','cost','usability','performance']);
const MAX=20;
const freezeDeep=value=>{
 if(value&&typeof value==='object'){
  Object.values(value).forEach(freezeDeep);
  Object.freeze(value);
 }
 return value;
};
export function planAtlasSelfImprovement({constitution,roadmap,observations=[]}={}){
 if(typeof constitution!=='string'||!constitution.trim()||constitution.length>20000||
    typeof roadmap!=='string'||!roadmap.trim()||roadmap.length>30000||
    !Array.isArray(observations)||observations.length>MAX)
  throw Error('Bounded constitution, roadmap and observations required');
 const proposals=observations.map(o=>{
  if(!o||!ID.test(o.id||'')||!ALLOWED.has(o.area)||
     typeof o.problem!=='string'||!o.problem.trim()||o.problem.length>1000||
     typeof o.evidence!=='string'||!o.evidence.trim()||o.evidence.length>2000||
     typeof o.principle!=='string'||!o.principle.trim()||o.principle.length>500||
     !constitution.includes(o.principle)||
     typeof o.roadmapReference!=='string'||!o.roadmapReference.trim()||
     !roadmap.includes(o.roadmapReference)||
     !Array.isArray(o.candidates)||o.candidates.length<2||o.candidates.length>5)
   throw Error('Ungrounded or malformed improvement observation');
  const candidates=o.candidates.map(c=>{
   if(!c||typeof c.description!=='string'||!c.description.trim()||
      c.description.length>1000||typeof c.risk!=='string'||!c.risk.trim()||
      c.risk.length>500||typeof c.acceptanceCriterion!=='string'||
      !c.acceptanceCriterion.trim()||c.acceptanceCriterion.length>500||
      !Number.isInteger(c.estimatedBenefit)||c.estimatedBenefit<0||
      c.estimatedBenefit>5||!Number.isInteger(c.estimatedRisk)||
      c.estimatedRisk<0||c.estimatedRisk>5)
    throw Error('Invalid candidate');
   return {description:c.description,risk:c.risk,
    acceptanceCriterion:c.acceptanceCriterion,estimatedBenefit:c.estimatedBenefit,
    estimatedRisk:c.estimatedRisk,score:c.estimatedBenefit-c.estimatedRisk};
  });
  const ranked=candidates.map((candidate,index)=>({...candidate,index}))
   .sort((a,b)=>b.score-a.score||a.estimatedRisk-b.estimatedRisk||a.index-b.index);
  return {id:o.id,area:o.area,problem:o.problem,evidence:o.evidence,
   principle:o.principle,roadmapReference:o.roadmapReference,
   candidates:ranked,preferredCandidateIndex:ranked[0].index,
   critique:'Scores are subjective estimates, not tested outcomes. Validate evidence, assumptions and regressions independently.',
   status:'proposal_only',requiresHumanApproval:true,
   patchApplied:false,codeExecuted:false};
 });
 if(new Set(proposals.map(p=>p.id)).size!==proposals.length)
  throw Error('Duplicate proposal ID');
 return freezeDeep({schemaVersion:1,mode:'dry_run',proposals,
  capabilities:{execute:false,write:false,deploy:false,approve:false},
  note:'Only structured proposals; no code was executed or changed by this planner'});
}
