import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasHouseMode} from '../cloud/public/house/atlas-mode.js';
test('browser house mode is reversible without replacing the renderer',()=>{
 const calls=[];
 const mode=createAtlasHouseMode({
  enter:()=>calls.push('enter'),
  leave:()=>calls.push('leave'),
  renderFrame:ms=>calls.push(ms)
 });
 assert.equal(mode.mode,'house');
 assert.equal(mode.frame(16),false);
 assert.equal(mode.activate(),true);
 assert.equal(mode.activate(),false);
 mode.frame(16);mode.frame(20);
 assert.equal(mode.deactivate(),true);
 assert.equal(mode.deactivate(),false);
 assert.deepEqual(calls,['enter',16,36,'leave']);
 assert.equal(mode.rendererCreated,false);
});
test('mode disposal restores house and blocks reactivation',()=>{
 const calls=[];
 const mode=createAtlasHouseMode({enter:()=>calls.push('enter'),
  leave:()=>calls.push('leave'),renderFrame:()=>{}});
 mode.activate();assert.throws(()=>mode.frame(-1));
 mode.dispose();mode.dispose();
 assert.deepEqual(calls,['enter','leave']);
 assert.throws(()=>mode.activate());
});
test('mode fails closed on invalid adapters and frame deltas',()=>{
 assert.throws(()=>createAtlasHouseMode({enter(){},leave(){}}));
 const mode=createAtlasHouseMode({enter(){},leave(){},renderFrame(){}});
 mode.activate();assert.throws(()=>mode.frame(Infinity));
 assert.throws(()=>mode.frame(1001));
});
