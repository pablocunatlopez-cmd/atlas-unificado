import http from 'node:http';
import {probeAtlasCpuHardware} from './atlas-cpu-hardware-probe.mjs';
import {diagnoseAtlasLocalCpu} from './atlas-local-cpu-diagnostics.mjs';
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
  '<pre id="output" role="status">Pendiente de comprobación</pre></main>'+
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
  if(req.method==='POST'&&req.url==='/diagnostics'){
   const origin=req.headers.origin;
   if(origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin)){
    send(403,'text/plain','Invalid origin');return;
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
