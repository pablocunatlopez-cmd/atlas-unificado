import http from 'node:http';
import {probeAtlasCpuHardware} from './atlas-cpu-hardware-probe.mjs';
import {diagnoseAtlasLocalCpu} from './atlas-local-cpu-diagnostics.mjs';
import {queryAtlasLocalLlama} from './atlas-local-llama-client.mjs';
/**
 * Localhost-only, opt-in demo HTTP server.
 * No static file serving, remote binding or automatic model startup.
 */
export function createAtlasCpuDemoServer({
 osApi,fetchImpl,host='127.0.0.1',port=8765
}={}){
 if(host!=='127.0.0.1'||!Number.isSafeInteger(port)||port<1024||port>65535)
  throw Error('Demo must bind to a safe localhost port');
 const page='<!doctype html><html lang="es"><meta charset="utf-8"><title>Atlas CPU</title>'+
  '<main><h1>Atlas · Diagnóstico CPU</h1><p>Solo localhost. No se inicia ningún modelo.</p>'+
  '<button id="check" type="button">Comprobar CPU y servidor local</button>'+
  '<pre id="output" role="status">Pendiente de comprobación</pre>'+ 
  '<label for="prompt">Pregunta local</label><input id="prompt" maxlength="2000" autocomplete="off">'+
  '<button id="ask" type="button">Preguntar a llama.cpp</button>'+ 
  '<pre id="answer" role="status">Sin consultas</pre></main>'+
  '<script src="/client.js"></script></html>';
 const script=`const button=document.getElementById('check');
const output=document.getElementById('output');
button.addEventListener('click',async()=>{
 button.disabled=true;output.textContent='Comprobando…';
 try{
  const response=await fetch('/diagnostics',{method:'POST',redirect:'error'});
  if(!response.ok)throw Error('Diagnóstico HTTP '+response.status);
  const data=await response.json();
  output.textContent=JSON.stringify(data,null,2);
 }catch(error){output.textContent='Error: '+error.message;}
 finally{button.disabled=false;}
});
const ask=document.getElementById('ask');
ask.addEventListener('click',async()=>{
 const prompt=document.getElementById('prompt').value.trim();
 if(!prompt)return;
 ask.disabled=true;document.getElementById('answer').textContent='Consultando…';
 try{
  const response=await fetch('/infer',{method:'POST',redirect:'error',
   headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});
  const data=await response.json();
  document.getElementById('answer').textContent=response.ok?data.answer:'Error: '+data.error;
 }catch{document.getElementById('answer').textContent='Error de conexión';}
 finally{ask.disabled=false;}
});`;
 const server=http.createServer(async(req,res)=>{
  const send=(status,type,body)=>{
   res.writeHead(status,{'content-type':type,'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
   res.end(body);
  };
  const hostHeader=req.headers.host;
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(hostHeader)){
   send(403,'text/plain','Invalid host');return;
  }
  if(req.method==='GET'&&req.url==='/'){send(200,'text/html; charset=utf-8',page);return;}
  if(req.method==='GET'&&req.url==='/client.js'){send(200,'text/javascript; charset=utf-8',script);return;}
  if(req.method==='POST'&&['/diagnostics','/infer'].includes(req.url)){
   const origin=req.headers.origin;
   const contentType=String(req.headers['content-type']||'');
   const fetchSite=req.headers['sec-fetch-site'];
   if((fetchSite&&fetchSite!=='same-origin')||
    !origin||
    (origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin))){
    send(403,'text/plain','Invalid origin');return;
   }
   if(req.url==='/infer'){
    if(!contentType.toLowerCase().startsWith('application/json')){
     send(415,'application/json',JSON.stringify({error:'json_required'}));return;
    }
    let body='';
    try{
     for await(const chunk of req){
      body+=chunk.toString();
      if(body.length>3000)throw Error('too_large');
     }
     const payload=JSON.parse(body);
     if(!payload||typeof payload.prompt!=='string'||
      !payload.prompt.trim()||payload.prompt.length>2000)
      throw Error('invalid_prompt');
     const result=await queryAtlasLocalLlama({
      messages:[{role:'user',content:payload.prompt.trim()}],fetchImpl,
      timeoutMs:30000,maxTokens:256
     });
     send(200,'application/json; charset=utf-8',
      JSON.stringify({answer:result.answer,local:true,verified:true,verification:'llama_response_received'}));
    }catch{send(422,'application/json; charset=utf-8',
     JSON.stringify({error:'local_inference_failed'}));}
    return;
   }
   try{
    const freeRamMb=probeAtlasCpuHardware(osApi?{osApi}:undefined).freeRamMb;
    const result=await diagnoseAtlasLocalCpu({freeRamMb,fetchImpl});
    send(200,'application/json; charset=utf-8',JSON.stringify(result));
   }catch{send(503,'application/json; charset=utf-8',JSON.stringify({error:'diagnostic_failed'}));}
   return;
  }
  send(404,'text/plain','Not found');
 });
 return Object.freeze({
  listen:()=>new Promise((resolve,reject)=>{
   server.once('error',reject);
   server.listen(port,host,()=>{server.removeListener('error',reject);resolve(server.address());});
  }),
  close:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())),
  server
 });
}
