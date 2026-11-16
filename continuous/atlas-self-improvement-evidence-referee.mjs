import {verifyAtlasProposalEvidence} from './atlas-self-improvement-evidence.mjs';
const ROLES=new Set(['proponent','adversary']);
const ID=/^[A-Za-z0-9_-]{1,100}$/;
/**
 * Quote-level evidence referee. It only checks textual correspondence against
 * host-supplied snapshots, never semantic truth or factual contradiction.
 */
export function refereeAtlasDebateEvidence({proposal,sources,claims}={}){
 if(!proposal||!ID.test(proposal.id||'')||!Array.isArray(claims)||
    claims.length<1||claims.length>30)throw Error('Invalid bounded debate evidence');
 const ids=new Set();
 const normalized=claims.map(c=>{
  if(!c||!ID.test(c.id||'')||ids.has(c.id)||!ROLES.has(c.role)||
     typeof c.statement!=='string'||!c.statement.trim()||
     c.statement.length>1500||typeof c.quote!=='string'||
     typeof c.path!=='string'||!Number.isInteger(c.line))
   throw Error('Invalid evidence statement');
  ids.add(c.id);
  return {proposalId:proposal.id,path:c.path,line:c.line,quote:c.quote};
 });
 // The existing verifier bounds snapshot size and checks exact line matches.
 const verified=verifyAtlasProposalEvidence({proposal,sources,claims:normalized});
 const findings=claims.map((claim,i)=>Object.freeze({
  id:claim.id,role:claim.role,statement:claim.statement,
  status:verified.findings[i].exact?'quotation_matched':'unverified',
  sourcePath:claim.path,line:claim.line,
  semanticTruth:'not_assessed'
 }));
 return Object.freeze({schemaVersion:1,mode:'dry_run',proposalId:proposal.id,
  findings:Object.freeze(findings),snapshotDigest:verified.snapshotDigest,
  allQuotationsMatched:verified.verifiedAgainstSuppliedSnapshots,
  semanticContradictionsDetected:false,
  limitation:'Contradiction or support of the statement cannot be inferred from quote matching',
  codeExecuted:false,patchApplied:false,authorizationGranted:false});
}
