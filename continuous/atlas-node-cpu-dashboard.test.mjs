import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountAtlasNodeCpuDashboard} from './atlas-node-cpu-dashboard.mjs';
test('integration reads actual host API only after dashboard button click',async()=>{
 let listener,reads=0,requests=0,renders=[];
 const button={};
 const root={
  addEventListener:(_,cb)=>{listener=cb;},
  removeEventListener:()=>{},
  contains:node=>node===button
 };
 const osApi={
  totalmem:()=>{reads++;return 8*1024**3;},
  freemem:()=>{reads++;return 6*1024**3;},
  cpus:()=>Array.from({length:4},()=>({}))
 };
 const mounted=mountAtlasNodeCpuDashboard({
  root,osApi,renderHtml:html=>renders.push(html),
  fetchImpl:async()=>{requests++;return {
   ok:true,text:async()=>JSON.stringify({status:'ok'})};}
 });
 assert.equal(reads,0);
 assert.equal(requests,0);
 assert.match(renders[0],/run-cpu-diagnostics/);
 await listener({target:{closest:()=>button}});
 assert.equal(reads,2);
 assert.equal(requests,1);
 assert.match(renders.at(-1),/Diagnóstico local/);
 mounted.dispose();
});
