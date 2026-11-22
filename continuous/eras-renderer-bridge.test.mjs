import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasRendererBridge} from './eras-renderer-bridge.mjs';
const node=(id,parent=null,x=0)=>({id,parent,type:'mesh',position:[x,0,0],rotation:[0,0,0],scale:[1,1,1],asset:''});
test('creates parents first, updates changed nodes, removes children first',async()=>{
 const calls=[];
 const bridge=createErasRendererBridge({
   create:async n=>calls.push('create:'+n.id),
   update:async n=>calls.push('update:'+n.id),
   destroy:async id=>calls.push('destroy:'+id)
 });
 assert.deepEqual(await bridge.sync({schemaVersion:1,nodes:[node('child','root'),node('root')]}),
  {created:2,updated:0,removed:0,total:2});
 assert.deepEqual(calls,['create:root','create:child']);
 await bridge.sync({schemaVersion:1,nodes:[node('child','root',4),node('root')]});
 assert.equal(calls.at(-1),'update:child');
 await bridge.sync({schemaVersion:1,nodes:[]});
 assert.deepEqual(calls.slice(-2),['destroy:child','destroy:root']);
 await bridge.dispose();
 await assert.rejects(bridge.sync({schemaVersion:1,nodes:[]}));
});
test('rejects malformed scene before invoking adapter',async()=>{
 const calls=[];
 const bridge=createErasRendererBridge({
   create:async n=>calls.push(n.id),update:async()=>{},destroy:async()=>{}
 });
 await assert.rejects(bridge.sync({schemaVersion:1,nodes:[node('orphan','missing')]}));
 await assert.rejects(bridge.sync({schemaVersion:1,nodes:[node('a','b'),node('b','a')]}));
 assert.deepEqual(calls,[]);
});
