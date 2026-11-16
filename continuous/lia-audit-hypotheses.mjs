import {buildLiaHypothesisLedger} from './lia-hypothesis-ledger.mjs';
/** Derive explicit, testable audit claims from observable outputs only.
 * These are NOT reconstructions of the model's private thoughts.
 */
export function deriveLiaAuditHypotheses({reviewed=false,reviewError=null,citationAudit=null,sources=[]}={}){
 const records=[];
 if(reviewed===true||typeof reviewError==='string'&&reviewError){
  records.push({id:'review-attempt',claim:'A second model pass was requested for this answer',origin:'tool',status:reviewed===true?'supported':'inconclusive',evidence:[{type:'tool-output',reference:reviewed===true?'chat:review-completed':'chat:review-failed',verified:true}],revisionOf:null,conclusion:reviewed===true?'Second pass completed; correctness not independently established':'Review failed or was interrupted'});
 }
 if(citationAudit&&typeof citationAudit==='object'){
  const unknown=Array.isArray(citationAudit.unknownLabels)?citationAudit.unknownLabels.filter(x=>typeof x==='string'):[];
  records.push({id:'citation-check',claim:'All detected citation labels refer to available sources',origin:'tool',status:unknown.length?'refuted':'supported',evidence:[{type:'tool-output',reference:'chat:citation-audit',verified:true}],revisionOf:null,conclusion:unknown.length?'Unresolved citation labels: '+unknown.slice(0,8).join(', '):'No unknown labels detected; source accuracy not established'});
 }
 return buildLiaHypothesisLedger(records);
}
