/**
 * A minimal local whisper.cpp transcription adapter. Audio is supplied as
 * an already existing host-approved file; no microphone is opened here.
 * Requires a separately installed whisper.cpp CLI and model.
 */
import {spawn as nodeSpawn} from 'node:child_process';
export async function transcribeAtlasLocalAudio({executable='whisper-cli',modelPath,audioPath,
 timeoutMs=120000,spawn=nodeSpawn}={}){
 const safePath=p=>typeof p==='string'&&p.startsWith('/')&&p.length<500&&
  p.split('/').slice(1).every(x=>x&&x!=='.'&&x!=='..')&&!/[\n\r\0]/.test(p);
 if(executable!=='whisper-cli'||!safePath(modelPath)||!safePath(audioPath)||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)
  throw Error('Invalid local transcription request');
 const child=spawn(executable,['-m',modelPath,'-f',audioPath,'-nt'],{
  shell:false,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH||'/usr/bin:/bin'}});
 return await new Promise(resolve=>{
  let done=false,output='',timedOut=false,overflow=false;
  const finish=(code,error)=>{
   if(done)return;done=true;clearTimeout(timer);
   resolve(Object.freeze({status:error?'process_error':timedOut?'timeout':overflow?'output_limit':code===0?'completed':'failed',
    transcript:code===0&&!timedOut&&!overflow&&!error?output.trim():null,
    verified:false,local:true,exitCode:code}));
  };
  const append=chunk=>{
   output+=String(chunk);
   if(output.length>100000){overflow=true;child.kill('SIGKILL');}
  };
  child.stdout.on('data',append);
  child.stderr.on('data',()=>{});
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
  child.once('error',error=>finish(null,error));
  child.once('close',code=>finish(code,null));
 });
}
