/** Strict comparison of two independently produced router audits.
 * A different fixture invalidates comparison, even if class counts match.
 */
export function compareAtlasRouterAudits(baseline,candidate,{minimumCases=30}={}){
 const valid=x=>x&&x.schema==='atlas-router-audit-v1'&&
  typeof x.fixtureHash==='string'&&/^sha256:[a-f0-9]{64}$/.test(x.fixtureHash)&&
  Number.isInteger(x.cases)&&x.cases>0&&typeof x.accuracy==='number'&&
  Number.isFinite(x.accuracy)&&x.accuracy>=0&&x.accuracy<=1&&
  x.perClass&&typeof x.perClass==='object'&&x.autoSwitch===false;
 if(!valid(baseline)||!valid(candidate)||!Number.isInteger(minimumCases)||minimumCases<1)
  throw new TypeError('Invalid router audit comparison');
 const comparable=baseline.fixtureHash===candidate.fixtureHash&&baseline.cases===candidate.cases;
 const adequate=comparable&&baseline.cases>=minimumCases;
 const labels=['exact-identifier','conceptual','ambiguous'];
 const changes=Object.fromEntries(labels.map(label=>{
  const b=baseline.perClass[label],c=candidate.perClass[label];
  if(!b||!c||![b.falsePositives,b.falseNegatives,c.falsePositives,c.falseNegatives].every(Number.isInteger))
   throw new TypeError('Missing class audit');
  return [label,{falsePositiveDelta:c.falsePositives-b.falsePositives,
   falseNegativeDelta:c.falseNegatives-b.falseNegatives}];
 }));
 const regression=Object.values(changes).some(x=>x.falsePositiveDelta>0||x.falseNegativeDelta>0);
 const verdict=!comparable?'incomparable-fixtures':!adequate?'insufficient-evidence':
  regression||candidate.accuracy<baseline.accuracy?'retain-baseline':'human-review';
 return Object.freeze({schema:'atlas-router-comparison-v1',fixtureHash:comparable?baseline.fixtureHash:null,
  comparable,adequateSample:adequate,accuracyDelta:comparable?candidate.accuracy-baseline.accuracy:null,
  changes,verdict,requiresHumanApproval:true,autoSwitch:false});
}
