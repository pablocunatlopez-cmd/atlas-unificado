import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LOR_FIELDS,situatedFrame,elevateFrame,validateLorRecord,coreEvaluationLor} from './lor-omega.mjs';
test('the recovered twelve-symbol vocabulary distinguishes environment, scale, measure and falsifiers',()=>{
 assert.equal(Object.keys(LOR_FIELDS).length,12);assert.equal(LOR_FIELDS.A,'ambiente');assert.equal(LOR_FIELDS.E,'escala');assert.equal(LOR_FIELDS.M,'medida');assert.equal(LOR_FIELDS.F,'falsadores');
 const parent=situatedFrame({object:'modelo',environment:'ordenador',perspective:'medición local',scale:'turno'}),lifted=elevateFrame(parent,'entorno de red');assert.equal(lifted.frame.object,'ordenador');assert.equal(lifted.frame.environment,'entorno de red');assert.deepEqual(lifted.parent,parent);assert.equal(parent.object,'modelo');
});
test('a failed or unexecuted proposal is not learning; unsupported physical claims remain explicit',()=>{
 const failed=coreEvaluationLor({at:new Date().toISOString(),parentId:'base',phase:'refuted',reason:'invalid_candidate_or_evaluation',accepted:false,observedDevelopment:{cases:5}});assert.equal(failed.L.newEvidence,false);assert.equal(failed.L.countsAsLearning,false);assert.ok(failed.unimplemented.some(item=>item.includes('Holonomía')));
 const forged=structuredClone(failed);forged.L.countsAsLearning=true;assert.throws(()=>validateLorRecord(forged),/evidencia nueva/);
 const missing=structuredClone(failed);delete missing.S.E;assert.throws(()=>validateLorRecord(missing),/doce/);
 const noMeasure=structuredClone(failed);noMeasure.S.M[0].value=Infinity;assert.throws(()=>validateLorRecord(noMeasure),/finitas/);
});
