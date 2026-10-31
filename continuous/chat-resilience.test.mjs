import test from 'node:test';
import assert from 'node:assert/strict';
import {chat} from './chat.mjs';
import {reviewCapabilities} from './autonomous-review.mjs';
const answer=text=>({ok:true,json:async()=>({choices:[{message:{content:text},finish_reason:'stop'}]})});
test('a failed second pass retains the draft and reports review failure',async()=>{
 let calls=0;
 const r=await chat({messages:[{role:'user',content:'17 por 23 en una frase'}],refute:true},[],async()=>++calls===1?answer('17 por 23 es 391.'):{ok:false,status:503});
 assert.equal(r.answer,'17 por 23 es 391.');assert.equal(r.reviewed,false);assert.match(r.reviewScope,/no completada/);assert.match(r.warnings.join(' '),/borrador/);
});
test('review instruction keeps original goal and asks for final answer, not an audit report',async()=>{
 let calls=0;
 const r=await chat({messages:[{role:'user',content:'17 por 23 en una frase'}],refute:true},[],async(_url,opts)=>{
  if(++calls===2){const text=JSON.parse(opts.body).messages.at(-1).content;assert.match(text,/SOLO la respuesta final/);assert.match(text,/17 por 23 en una frase/);}
  return answer('17 por 23 es 391.');
 });assert.equal(r.reviewed,true);
});
test('empty reasoning response retries with direct generation before failing',async()=>{
 let calls=0;
 const r=await chat({messages:[{role:'user',content:'Hola'}],refute:true},[],async(_url,opts)=>{
  calls++;if(calls===1)return answer('');if(calls===2)assert.equal(JSON.parse(opts.body).chat_template_kwargs.enable_thinking,false);
  return answer('Hola.');
 });assert.equal(r.answer,'Hola.');assert.equal(calls,3);assert.match(r.warnings[0],/respuesta vacía/);
});
test('server capabilities distinguish tool availability from turn activation',async()=>{
 let prompt='';
 const capabilities={tools:{available:2,requested:false},externalModels:{configured:false},localCouncil:{automatic:true}};
 await chat({messages:[{role:'user',content:'Qué herramientas tienes'}],json:true},[],async(_url,opts)=>{prompt=JSON.parse(opts.body).messages[0].content;return answer('{}');},'','',null,'',[],'',{capabilities});
 assert.ok(prompt.includes(JSON.stringify(capabilities)));assert.match(prompt,/no significa capacidad inexistente/);
});
test('background assessment abort propagates so the foreground can reclaim the model',async()=>{
 const controller=new AbortController();let assessmentStarted;
 const started=new Promise(resolve=>{assessmentStarted=resolve;});
 const work=reviewCapabilities([],'',{signal:controller.signal,assess:async(_e,_k,_fetch,signal)=>{assessmentStarted();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 await started;controller.abort(Error('Chat prioritario'));
 await assert.rejects(work,/Chat prioritario/);
});
test('already aborted chat does not start any generation',async()=>{
 const controller=new AbortController();controller.abort(Error('Cancelado'));
 await assert.rejects(chat({messages:[{role:'user',content:'Hola'}]},[],()=>{throw Error('No debe ejecutarse');},'','',null,'',[],'',{signal:controller.signal}),/Cancelado/);
});
