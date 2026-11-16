import {compareAtlasDecisions} from './atlas-self-improvement-decisions.mjs';
/**
 * Conservative contradiction gate: decisions are compared by stable proposal ID.
 * It does not infer semantic contradictions or approve any action.
 */
export function assessAtlasDecisionConsistency({
 proposal,history=[],evidence=null,changeExplanation=''
}={}){
 if(!proposal||typeof proposal.id!=='string'||typeof changeExplanation!=='string'||
    changeExplanation.length>2000)throw Error('Invalid consistency review');
 const past=compareAtlasDecisions(history,proposal.id);
 const last=past.decisions.at(-1);
 const evidenceDigest=evidence?.verifiedAgainstSuppliedSnapshots===true?
  evidence.snapshotDigest:null;
 const reasons=[];
 if(!evidenceDigest)reasons.push('no_verified_snapshot_quotes');
 if(last?.status==='rejected')reasons.push('previously_rejected');
 if(last?.status==='needs_evidence'&&
    (!evidenceDigest||evidenceDigest===last.evidenceDigest))
  reasons.push('no_new_verified_evidence');
 if(last&&evidenceDigest&&last.evidenceDigest!==evidenceDigest&&
    !changeExplanation.trim())reasons.push('changed_evidence_without_explanation');
 const recommendation=reasons.length?'hold_for_review':'eligible_for_human_review';
 return Object.freeze({proposalId:proposal.id,recommendation,
  reasons:Object.freeze(reasons),previousStatus:last?.status??'unknown',
  previousEvidenceDigest:last?.evidenceDigest??null,
  currentEvidenceDigest:evidenceDigest,
  changeExplanation:changeExplanation.trim()||null,
  authorizationGranted:false,patchApplied:false,codeExecuted:false,
  limitation:'Stable-ID and digest comparisons only; semantic contradictions are not established'});
}
