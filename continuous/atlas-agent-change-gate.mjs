/**
 * Atlas agent improvement gate, inspired by reviewable git-first agents.
 * Pure planning/evaluation: cannot run commands, merge PRs or spend tokens.
 */
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/;
const SAFE=new Set(['read','analyze','plan','test']);
const SENSITIVE=new Set(['write','execute','network','publish','delete']);
export function evaluateAtlasAgentChange({id,actions=[],checks={},approval=null}={}){
 if(typeof id!=='string'||!ID.test(id)||!Array.isArray(actions)||actions.length>100||
    !checks||typeof checks!=='object'||Array.isArray(checks))
   throw Error('Invalid agent change proposal');
 const normalized=[];
 for(const action of actions){
   if(!action||typeof action!=='object'||typeof action.kind!=='string'||
      !(SAFE.has(action.kind)||SENSITIVE.has(action.kind))||
      typeof action.target!=='string'||action.target.length>250||
      action.target.includes('..'))
     throw Error('Invalid agent action');
   normalized.push({kind:action.kind,target:action.target});
 }
 const requiresApproval=normalized.some(a=>SENSITIVE.has(a.kind));
 const required=['syntax','unit','security'];
 const failed=required.filter(k=>checks[k]!==true);
 // An approval token must be validated by the host; caller-supplied booleans are insufficient.
 const approved=approval?.verifiedByHost===true&&
   typeof approval?.principal==='string'&&approval.principal.length>0&&
   approval?.proposalId===id;
 const ready=failed.length===0&&(!requiresApproval||approved);
 return Object.freeze({
  proposalId:id,requiresApproval,approved:requiresApproval?approved:null,
  failedChecks:failed,readyForReview:ready,
  recommendation:ready?'review_only':failed.length?'run_or_fix_checks':'request_verified_approval',
  actions:normalized,
 });
}
