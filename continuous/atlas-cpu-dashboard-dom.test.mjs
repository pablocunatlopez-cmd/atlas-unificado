import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountAtlasCpuDiagnosticsButton} from './atlas-cpu-dashboard-dom.mjs';
test('button click triggers one explicit diagnostic and rerender',async()=>{
 let listener,checks=0,renders=0;
 const button={};
 const root={
  addEventListener:(type,cb)=>{assert.equal(type,'click');listener=cb;},
  removeEventListener:()=>{},
  contains:node=>node===button
 };
 const controller={
  runDiagnostics:async()=>{checks++;},
  render:()=>'<main>updated</main>'
 };
 const mount=mountAtlasCpuDiagnosticsButton({root,controller,
  onRender:html=>{renders++;assert.match(html,/updated/);}});
 assert.equal(checks,0);
 await listener({target:{closest:()=>button}});
 assert.equal(checks,1);
 assert.equal(renders,1);
 mount.dispose();
 await listener({target:{closest:()=>button}});
 assert.equal(checks,1);
});
test('ignores unrelated clicks',async()=>{
 let listener,checks=0;
 const root={addEventListener:(_,cb)=>{listener=cb;},
  removeEventListener:()=>{},contains:()=>true};
 mountAtlasCpuDiagnosticsButton({root,controller:{
  runDiagnostics:async()=>{checks++;},render:()=>''},onRender:()=>{}});
 await listener({target:{closest:()=>null}});
 assert.equal(checks,0);
});
