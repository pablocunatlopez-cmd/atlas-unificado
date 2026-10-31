import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCapabilities} from './audit-assessment.mjs';
test('auditor receives explicit evidence without chat permission flags',async()=>{
 const evidence={checks:[{id:'sum',passed:true}],internet:'not tested'};
 const report=await assessCapabilities(evidence,'',async(url,options)=>{
  const body=JSON.parse(options.body);
  assert.equal(body.chat_template_kwargs.enable_thinking,false);
  const {selectionCriteria,...received}=JSON.parse(body.messages[1].content);
  assert.deepEqual(received,evidence);
  assert.match(selectionCriteria,/Sin comparaciones ejecutadas/);
  assert.equal(body.messages.length,2);
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({diagnosis:'Una prueba aprobada',limitations:'Internet no probado',nextAction:'Conservar',intervalMinutes:0})}}]})};
 });
 assert.equal(report.intervalMinutes,5);
});
test('empty model output is rejected, never accepted as a diagnosis',async()=>{
 await assert.rejects(assessCapabilities({},'',async()=>({ok:true,json:async()=>({choices:[{message:{content:''}}]})})),/inválido/);
});
