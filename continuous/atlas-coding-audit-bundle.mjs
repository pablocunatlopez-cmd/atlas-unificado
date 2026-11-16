import {buildAtlasCodingAuditReport} from './atlas-coding-audit-report.mjs';
import {buildAtlasAuditHashChain,verifyAtlasAuditHashChain} from './atlas-coding-audit-hash-chain.mjs';
/**
 * A portable audit bundle. Both representations derive from the same observations.
 * No claim of authenticity is made without an independently trusted anchor.
 */
export function buildAtlasCodingAuditBundle({proposalId,transactionId,observations=[]}={}){
 const report=buildAtlasCodingAuditReport({proposalId,transactionId,observations});
 const chain=buildAtlasAuditHashChain({transactionId,observations});
 return Object.freeze({schemaVersion:1,report,chain,authorizationGranted:false,
  note:'Event chain does not authenticate proposalId; compare it to a trusted expectedProposalId. Integrity is not authorization or proof of commit'});
}
export function verifyAtlasCodingAuditBundle(bundle,{trustedFinalHash,expectedProposalId}={}){
 if(!bundle||bundle.schemaVersion!==1||!bundle.report||!bundle.chain||
    bundle.report.transactionId!==bundle.chain.transactionId||
    (expectedProposalId!==undefined&&bundle.report.proposalId!==expectedProposalId)||
    !Array.isArray(bundle.report.events)||!Array.isArray(bundle.chain.entries)||
    bundle.report.events.length!==bundle.chain.entries.length)
  return Object.freeze({valid:false,anchored:false,authorizationGranted:false});
 const chainResult=verifyAtlasAuditHashChain(bundle.chain,{trustedFinalHash});
 const matches=bundle.report.events.every((event,index)=>{
  const entry=bundle.chain.entries[index];
  return event.index===entry.index&&event.atMs===entry.atMs&&
   event.status===entry.status&&event.source===entry.source;
 });
 return Object.freeze({valid:chainResult.valid&&matches,
  anchored:chainResult.anchored&&matches,authorizationGranted:false});
}
