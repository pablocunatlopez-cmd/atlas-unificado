import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCanonicalWorldSpec} from './atlas-canonical-world-spec.mjs';
import {planAtlasCanonicalThreeScene} from './atlas-canonical-three-scene-plan.mjs';
import {createAtlasCanonicalNavigation} from './atlas-canonical-navigation.mjs';
import {createAtlasCameraTransition,mapAtlasTouchOrbit} from './atlas-canonical-camera-controls.mjs';
function navigation(){
 const spec=createAtlasCanonicalWorldSpec();
 return createAtlasCanonicalNavigation({spec,plan:planAtlasCanonicalThreeScene(spec)});
}
test('camera interpolates and completes at target without invoking renderer',()=>{
 const control=createAtlasCameraTransition({navigation:navigation(),durationMs:600});
 const started=control.begin('spiral');
 assert.equal(started.active,true);
 assert.equal(control.frame(0).progress,0);
 assert.equal(control.frame(300).progress,0.5);
 assert.equal(control.frame(600).finished,true);
 assert.equal(control.active,false);
 assert.equal(control.rendererInvoked,false);
});
test('active transition rejects overlapping commands and negative time',()=>{
 const control=createAtlasCameraTransition({navigation:navigation()});
 control.begin('spiral');
 assert.throws(()=>control.begin('mental'));
 assert.throws(()=>control.frame(-1));
});
test('touch gestures are bounded and reject invalid viewports',()=>{
 const orbit=mapAtlasTouchOrbit({dx:10000,dy:-10000,
  viewportWidth:400,viewportHeight:800});
 assert.equal(orbit.yaw,Math.PI);
 assert.equal(orbit.pitch,-Math.PI/3);
 assert.throws(()=>mapAtlasTouchOrbit({dx:1,dy:1,viewportWidth:0,viewportHeight:500}));
});
