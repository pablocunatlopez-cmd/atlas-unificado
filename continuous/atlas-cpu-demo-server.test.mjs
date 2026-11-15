import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCpuDemoServer} from './atlas-cpu-demo-server.mjs';
test('demo serves UI and requires an explicit POST to diagnose',async()=>{
 let probes=0;
 const port=19091;
 const demo=createAtlasCpuDemoServer({port,
  osApi:{totalmem:()=>8*1024**3,freemem:()=>6*1024**3,
   cpus:()=>Array.from({length:4},()=>({}))},
  fetchImpl:async()=>{probes++;return {ok:true,text:async()=>JSON.stringify({status:'ok'})};}
 });
 await demo.listen();
 try{
  const page=await fetch('http://127.0.0.1:'+port+'/');
  assert.equal(page.status,200);
  assert.match(await page.text(),/Comprobar CPU/);
  assert.equal(probes,0);
  const bad=await fetch('http://127.0.0.1:'+port+'/diagnostics');
  assert.equal(bad.status,404);
  assert.equal(probes,0);
  const good=await fetch('http://127.0.0.1:'+port+'/diagnostics',{method:'POST'});
  assert.equal(good.status,200);
  assert.equal((await good.json()).status,'candidate_ready');
  assert.equal(probes,1);
 }finally{await demo.close();}
});
test('demo rejects remote bind configuration',()=>{
 assert.throws(()=>createAtlasCpuDemoServer({host:'0.0.0.0'}));
});

test('local inference requires explicit POST and returns mocked answer',async()=>{
 const port=19092;
 let calls=0;
 const demo=createAtlasCpuDemoServer({port,
  fetchImpl:async(url)=>{
   calls++;
   assert.equal(url,'http://127.0.0.1:8080/v1/chat/completions');
   return {ok:true,text:async()=>JSON.stringify({
    choices:[{message:{content:'Respuesta local'}}]})};
  }
 });
 await demo.listen();
 try{
  const before=await fetch('http://127.0.0.1:'+port+'/infer');
  assert.equal(before.status,404);
  assert.equal(calls,0);
  const denied=await fetch('http://127.0.0.1:'+port+'/infer',{
   method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},
   body:JSON.stringify({prompt:'Hola'})});
  assert.equal(denied.status,403);
  assert.equal(calls,0);
  const response=await fetch('http://127.0.0.1:'+port+'/infer',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({prompt:'Hola'})});
  assert.equal(response.status,200);
  assert.equal((await response.json()).answer,'Respuesta local');
  assert.equal(calls,1);
 }finally{await demo.close();}
});
