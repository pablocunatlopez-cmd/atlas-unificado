import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCanonicalWorldSpec} from './atlas-canonical-world-spec.mjs';
import {planAtlasCanonicalThreeScene} from './atlas-canonical-three-scene-plan.mjs';
import {createAtlasCanonicalNavigation} from './atlas-canonical-navigation.mjs';
function setup(){
 const spec=createAtlasCanonicalWorldSpec();
 return createAtlasCanonicalNavigation({spec,plan:planAtlasCanonicalThreeScene(spec)});
}
test('observer navigates to spiral and ERAS, then back',()=>{
 const nav=setup();
 assert.equal(nav.current,'observer');
 assert.deepEqual(nav.available,['spiral']);
 nav.go('spiral');nav.go('eras-house');
 assert.equal(nav.erasPortalAvailable,true);
 assert.equal(nav.historyDepth,2);
 nav.back();assert.equal(nav.current,'spiral');
 nav.back();assert.equal(nav.current,'observer');
 assert.equal(nav.rendererInvoked,false);
});
test('prevents teleporting across unrelated vertices',()=>{
 const nav=setup();
 assert.throws(()=>nav.go('event'));
 nav.go('spiral');nav.go('mental');
 assert.throws(()=>nav.go('physical'));
 nav.back();nav.go('event');
 assert.equal(nav.pose().target,'event');
});
test('camera pose is bounded and host-driven',()=>{
 const nav=setup();
 const pose=nav.pose();
 assert.equal(pose.cameraPosition.length,3);
 assert.equal(pose.transition,'host_renderer_opt_in');
 assert.equal(nav.codeExecuted,false);
});
