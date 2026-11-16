import {createHash} from 'node:crypto';
const PATH=/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_.\/-]{1,240}$/;
/**
 * Validates exact, line-numbered quotations against host-supplied snapshots.
 * This checks textual correspondence only, not the truth of the claim.
 */
export function verifyAtlasProposalEvidence({proposal,sources,claims}={}){
 if(!proposal||typeof proposal.id!=='string'||!Array.isArray(sources)||
    sources.length<1||sources.length>30||!Array.isArray(claims)||
    claims.length<1||claims.length>20)
  throw Error('Bounded proposal, sources and claims required');
 const files=new Map();
 for(const s of sources){
  if(!s||!PATH.test(s.path||'')||typeof s.content!=='string'||
     s.content.length>50000||files.has(s.path))throw Error('Invalid source snapshot');
  files.set(s.path,s.content.split(/\r?\n/));
 }
 const findings=claims.map(claim=>{
  if(!claim||claim.proposalId!==proposal.id||!PATH.test(claim.path||'')||
     !Number.isInteger(claim.line)||claim.line<1||
     typeof claim.quote!=='string'||!claim.quote.trim()||
     claim.quote.length>1000)throw Error('Malformed evidence claim');
  const lines=files.get(claim.path);
  const exact=Boolean(lines&&lines[claim.line-1]===claim.quote);
  return Object.freeze({path:claim.path,line:claim.line,exact,
   reason:exact?'exact_snapshot_match':'unverified_or_mismatched_quote'});
 });
 const verified=findings.every(f=>f.exact);
 const digest=createHash('sha256').update(JSON.stringify(
  [...files.entries()].map(([path,lines])=>({path,content:lines.join('\n')}))
 )).digest('hex');
 return Object.freeze({schemaVersion:1,proposalId:proposal.id,
  verifiedAgainstSuppliedSnapshots:verified,
  findings:Object.freeze(findings),snapshotDigest:digest,
  sourceTrust:'host_supplied_unverified',codeExecuted:false,patchApplied:false,
  note:'Exact quote matching does not establish that the source is accurate or the improvement is justified'});
}
