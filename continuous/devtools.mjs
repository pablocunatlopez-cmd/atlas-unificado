import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
let running=false;
export async function testGame(){
 if(running)return {error:'Ya hay una prueba en marcha'};
 running=true;
 try{return await new Promise(resolve=>{let output='';const p=spawn(process.execPath,['--test',path.join(root,'studio','logic.test.mjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>p.kill(),15000);for(const s of [p.stdout,p.stderr])s.on('data',d=>output=(output+d).slice(-12000));p.on('error',e=>{clearTimeout(timer);resolve({passed:false,error:e.message});});p.on('close',code=>{clearTimeout(timer);resolve({passed:code===0,code,output,at:new Date().toISOString(),scope:'Pruebas de lógica; no acreditan calidad AAA ni compilación Unity'});});});}finally{running=false;}
}
