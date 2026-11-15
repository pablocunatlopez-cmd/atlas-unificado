import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ATLAS_FREE_TOOL_CATALOG,planAtlasFreeToolAdoption} from './atlas-free-tool-catalog.mjs';
test('all tools are opt-in and never automatically installed',()=>{
 const planned=planAtlasFreeToolAdoption();
 assert.equal(planned.length,5);
 assert.ok(planned.every(x=>x.status==='approval_required'));
 assert.ok(planned.every(x=>x.automaticInstallation===false));
 assert.ok(ATLAS_FREE_TOOL_CATALOG.every(x=>x.defaultEnabled===false));
});
test('approval and installation still require host verification',()=>{
 const planned=planAtlasFreeToolAdoption({
  approved:['llama-cpp'],installed:['llama-cpp']});
 assert.equal(planned[0].status,'ready_for_host_verification');
 assert.equal(planned[0].executable,false);
 assert.throws(()=>planAtlasFreeToolAdoption({approved:['unknown']}));
});
