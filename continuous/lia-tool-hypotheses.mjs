import {buildLiaHypothesisLedger} from './lia-hypothesis-ledger.mjs';
/** The caller must already have validated the tool output via formatExecutedToolAnswer.
 * This is evidence of a completed deterministic computation, not a universal truth claim.
 */
export function buildVerifiedToolHypotheses(toolRun){
 if(!toolRun||toolRun.used!==true||toolRun.error||typeof toolRun.curriculumTaskId!=='string')return [];
 return buildLiaHypothesisLedger([{
  id:'validated-tool-result',origin:'tool',status:'supported',
  claim:'A deterministic tool result was accepted by the coordinator output validator',
  evidence:[{type:'tool-output',reference:'validated-task:'+toolRun.curriculumTaskId.slice(0,80),verified:true}],
  revisionOf:null,conclusion:'Validated computation output returned; external factual accuracy not established'
 }]);
}
