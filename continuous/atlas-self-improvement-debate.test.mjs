import {test} from 'node:test';
import assert from 'node:assert/strict';
import {debateAtlasImprovement} from './atlas-self-improvement-debate.mjs';
const base={proposal:{id:'SELF_011'},
 proponent:{thesis:'Evidence checks reduce unsupported proposals',
  evidenceReference:'docs/roadmap.md:12',responses:[]},
 adversary:{counterargument:'Text matching does not verify truth',
  evidenceReference:'docs/roadmap.md:15',objections:[{
   id:'OBJECTION_1',claim:'Evidence may be stale',evidenceReference:'docs/roadmap.md:15'
  }]}};
test('debate preserves unresolved adversarial objections',()=>{
 const r=debateAtlasImprovement(base);
 assert.equal(r.verdict,'unresolved_objections');
 assert.deepEqual(r.unresolvedObjectionIds,['OBJECTION_1']);
 assert.equal(r.authorizationGranted,false);assert.equal(r.codeExecuted,false);
});
test('reply records disagreement without claiming verification',()=>{
 const r=debateAtlasImprovement({...base,proponent:{...base.proponent,responses:[{
  objectionId:'OBJECTION_1',reply:'Add source revision metadata',
  evidenceReference:'docs/roadmap.md:16'}]}});
 assert.equal(r.verdict,'arguments_recorded_not_verified');
 assert.deepEqual(r.unresolvedObjectionIds,[]);
 assert.equal(r.patchApplied,false);
});
test('debate rejects fabricated objection references and duplicates',()=>{
 assert.throws(()=>debateAtlasImprovement({...base,proponent:{...base.proponent,
  responses:[{objectionId:'UNKNOWN',reply:'Answer',evidenceReference:'file:1'}]}}));
 assert.throws(()=>debateAtlasImprovement({...base,adversary:{...base.adversary,
  objections:[...base.adversary.objections,...base.adversary.objections]}}));
});
