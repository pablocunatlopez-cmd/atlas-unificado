import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasErasHouseBridge} from './atlas-eras-house-bridge.mjs';
test('bridge uses existing house scene and explicit host lifecycle',()=>{
 const calls=[];
 const house={scene:{name:'existing-house'}};
 const experience={mount(){calls.push('mount');return {objects:13};},
  navigate(id){calls.push('navigate:'+id);return {to:id};},
  tick(ms){calls.push('tick:'+ms);return {finished:true};},
  unmount(){calls.push('unmount');}};
 const bridge=createAtlasErasHouseBridge({house,experience});
 assert.equal(bridge.attached,false);
 assert.throws(()=>bridge.navigate('spiral'));
 assert.equal(bridge.attach().rendererReused,true);
 assert.throws(()=>bridge.attach());
 assert.equal(bridge.navigate('spiral').to,'spiral');
 bridge.frame(650);bridge.detach();
 assert.deepEqual(calls,['mount','navigate:spiral','tick:650','unmount']);
 assert.equal(bridge.rendererCreated,false);
});
