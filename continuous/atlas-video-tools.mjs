// Fixed local Wan workflow, independent of OpenField's gated LTX providers.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
const MEDIA=process.env.ATLAS_MEDIA_ROOT||path.join(path.dirname(fileURLToPath(import.meta.url)),'data','media'),COMFY=path.join(MEDIA,'ComfyUI'),PYTHON=path.join(MEDIA,'venv','Scripts','python.exe');
const ORIGIN='http://127.0.0.1:8188',ID=/^video-\d{13}-[a-f0-9]{8}$/;
const FILES=[{directory:'diffusion_models',name:'wan2.1_t2v_1.3B_fp16.safetensors',bytes:2838303560,sha256:'be531024cd9018cb5b48c40cfbb6a6191645b1c792eb8bf4f8c1c6e10f924dc5'},{directory:'text_encoders',name:'umt5_xxl_fp8_e4m3fn_scaled.safetensors',bytes:6735906897,sha256:'c3355d30191f1f066b26d93fba017ae9809dce6c627dda5f6a66eaa651204f68'},{directory:'vae',name:'wan_2.1_vae.safetensors',bytes:253815318,sha256:'2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b'}];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function jsonFile(file,fallback=null){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}}
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
function alive(pid){if(!Number.isInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}}
async function command(executable,args,{cwd=MEDIA,env={},signal,timeout=60000,maxBytes=100000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{cwd,env:{...process.env,...env},windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let output='',errorText='',settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  const kill=()=>{if(process.platform==='win32')execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill('SIGTERM');};
  const abort=()=>{kill();finish(signal.reason||Error('Operación cancelada'));};
  child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output)>maxBytes){kill();finish(Error('Salida de proceso demasiado grande'));}});child.stderr.on('data',chunk=>errorText=(errorText+chunk).slice(-3000));
  child.once('error',error=>finish(error));child.once('close',code=>code===0?finish(null,output.trim()):finish(Error('El proceso multimedia terminó con código '+code+': '+errorText.slice(-500))));
  const timer=setTimeout(()=>{kill();finish(Error('Tiempo máximo del proceso multimedia agotado'));},timeout);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 });
}

export function videoOptions(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Opciones de vídeo inválidas.');
 const value={frames:input.frames??17,width:input.width??480,height:input.height??272,steps:input.steps??5,fps:input.fps??8,seed:input.seed??Math.floor(Math.random()*2147483647)};
 if(!Number.isInteger(value.frames)||value.frames<5||value.frames>81||(value.frames-1)%4)throw Error('El vídeo necesita entre 5 y 81 fotogramas, en grupos de 4 más 1.');
 if(!Number.isInteger(value.width)||!Number.isInteger(value.height)||value.width<256||value.height<256||value.width>832||value.height>480||value.width%16||value.height%16||value.width*value.height>399360)throw Error('Resolución fuera del presupuesto local.');
 if(!Number.isInteger(value.steps)||value.steps<1||value.steps>30||!Number.isFinite(value.fps)||value.fps<1||value.fps>24||!Number.isSafeInteger(value.seed)||value.seed<0||value.seed>2147483647)throw Error('Muestreo o cadencia fuera de límites.');
 return value;
}
export function wanWorkflow(prompt,id,options={}){
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw Error('Describe el vídeo con entre 1 y 2000 caracteres.');if(!ID.test(id))throw Error('Identificador de vídeo inválido.');
 const o=videoOptions(options);
 return {'1':{class_type:'UNETLoader',inputs:{unet_name:FILES[0].name,weight_dtype:'default'}},'2':{class_type:'CLIPLoader',inputs:{clip_name:FILES[1].name,type:'wan',device:'default'}},'3':{class_type:'VAELoader',inputs:{vae_name:FILES[2].name}},'4':{class_type:'CLIPTextEncode',inputs:{clip:['2',0],text:prompt.trim()}},'5':{class_type:'CLIPTextEncode',inputs:{clip:['2',0],text:'low quality, blurry, static, subtitles, watermark, distorted anatomy, flicker, oversaturated'}},'6':{class_type:'EmptyHunyuanLatentVideo',inputs:{width:o.width,height:o.height,length:o.frames,batch_size:1}},'7':{class_type:'ModelSamplingSD3',inputs:{model:['1',0],shift:8}},'8':{class_type:'KSampler',inputs:{model:['7',0],positive:['4',0],negative:['5',0],latent_image:['6',0],seed:o.seed,steps:o.steps,cfg:6,sampler_name:'uni_pc',scheduler:'simple',denoise:1}},'9':{class_type:'VAEDecode',inputs:{samples:['8',0],vae:['3',0]}},'10':{class_type:'SaveWEBM',inputs:{images:['9',0],filename_prefix:'atlas/'+id,codec:'vp9',fps:o.fps,crf:30}}};
}

export function createVideoTools({mediaRoot=MEDIA,python=PYTHON,origin=ORIGIN,request=fetch,run=command,sleep=pause}={}){
 const comfyRoot=path.join(mediaRoot,'ComfyUI'),artifacts=path.join(mediaRoot,'artifacts'),runtimeFile=path.join(mediaRoot,'comfy-runtime.json');
 let ownChild=null,activePrompt=null,starting=null,generationBusy=false;
 const environment={PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HOME:path.join(mediaRoot,'cache','huggingface'),HF_HUB_CACHE:path.join(mediaRoot,'cache','huggingface','hub'),TORCH_HOME:path.join(mediaRoot,'cache','torch'),TORCHINDUCTOR_CACHE_DIR:path.join(mediaRoot,'cache','torchinductor'),CUDA_CACHE_PATH:path.join(mediaRoot,'cache','cuda'),XDG_CACHE_HOME:path.join(mediaRoot,'cache'),PIP_CACHE_DIR:path.join(mediaRoot,'cache','pip'),TEMP:path.join(mediaRoot,'tmp'),TMP:path.join(mediaRoot,'tmp')};
 async function api(route,options={}){const response=await request(origin+route,{...options,signal:options.signal||AbortSignal.timeout(10000)});if(!response.ok)throw Error('ComfyUI devolvió HTTP '+response.status);return response.json();}
 async function health(){try{return await api('/system_stats',{signal:AbortSignal.timeout(2000)});}catch{return null;}}
 async function ownedRecord(){
  const record=await jsonFile(runtimeFile);if(!record||!alive(record.pid)||record.script!==path.join(comfyRoot,'main.py')||record.python!==python)return null;
  if(ownChild?.pid===record.pid)return record;
  if(process.platform!=='win32')return null;
  const script=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${record.pid}';if($p){@{executable=$p.ExecutablePath;command=$p.CommandLine}|ConvertTo-Json -Compress}`;
  try{const data=JSON.parse(await run(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{timeout:10000}));return data.executable?.toLowerCase()===python.toLowerCase()&&data.command?.includes(path.join(comfyRoot,'main.py'))?record:null;}catch{return null;}
 }
 async function videoStatus(){
  const downloads=await jsonFile(path.join(mediaRoot,'download-status.json'),{status:'not_started',files:[]});
  const models=await Promise.all(FILES.map(async model=>{const file=path.join(comfyRoot,'models',model.directory,model.name);let size=0;try{size=(await fs.stat(file)).size;}catch{}const evidence=downloads.files?.find(item=>item.name===model.name);return {name:model.name,expectedBytes:model.bytes,downloadedBytes:size||evidence?.downloadedBytes||0,verified:size===model.bytes&&evidence?.status==='verified'&&evidence?.expectedSha256===model.sha256&&evidence?.sha256===model.sha256};}));
  const runtime=await health(),record=await ownedRecord();
  const environmentReady=await exists(python)&&await exists(path.join(mediaRoot,'runtime-ready.json'));
  const proof=await jsonFile(path.join(mediaRoot,'render-proof.json'));let lastRender=null;
  if(proof&&ID.test(proof.id)){try{const stat=await fs.stat(path.join(artifacts,proof.id+'.mp4'));if(stat.isFile()&&stat.size===proof.bytes)lastRender={id:proof.id,bytes:proof.bytes,sha256:proof.sha256,elapsedMs:proof.elapsedMs,at:proof.at,parameters:proof.parameters};}catch{}}
  return {provider:'wan21-comfy',ready:environmentReady&&models.every(model=>model.verified),requiresExclusiveGpu:true,model:'Wan2.1 T2V 1.3B',models,runtime:{running:!!runtime,owned:!!record},downloads:{status:downloads.status,error:downloads.error||null},openfield:{sourceInstalled:await exists(path.join(mediaRoot,'openfield','server','index.ts')),appReady:await exists(path.join(mediaRoot,'openfield','dist','index.html')),nativeVideoReady:false,reason:'Los motores de vídeo nativos de OpenField requieren otros pesos; el LTX predeterminado es gated y recomienda más VRAM. Wan se integra como proveedor Comfy independiente.'},limits:{maxFrames:81,maxSteps:30,defaultFrames:17,defaultWidth:480,defaultHeight:272,defaultFps:8},lastRender,scope:lastRender?'Render local completado y conservado. La calidad y la velocidad dependen del presupuesto de cada trabajo.':'Generación neuronal local por ComfyUI. No se ha acreditado calidad de producción ni rendimiento en esta GPU hasta completar un render.'};
 }
 async function startVideoRuntime(){
  if(starting)return starting;
  starting=(async()=>{
   const status=await videoStatus();if(!status.ready)throw Error('El motor de vídeo todavía necesita completar modelos o dependencias.');
   const existing=await health();if(existing){if(!await ownedRecord())throw Error('El puerto de vídeo pertenece a otro proceso; no se reutiliza ni se detiene.');return {running:true,reused:true};}
   await fs.mkdir(path.join(mediaRoot,'tmp'),{recursive:true});
   const stdout=await fs.open(path.join(mediaRoot,'comfy-stdout.log'),'a'),stderr=await fs.open(path.join(mediaRoot,'comfy-stderr.log'),'a');
   ownChild=spawn(python,[path.join(comfyRoot,'main.py'),'--listen','127.0.0.1','--port','8188','--disable-auto-launch','--lowvram','--cpu-vae','--reserve-vram','0.8','--preview-method','none','--offline'],{cwd:comfyRoot,windowsHide:true,shell:false,env:{...process.env,...environment},stdio:['ignore',stdout.fd,stderr.fd]});
   const child=ownChild;let launchError;child.once('error',error=>launchError=error);await fs.writeFile(runtimeFile,JSON.stringify({pid:child.pid,python,script:path.join(comfyRoot,'main.py'),at:new Date().toISOString()}));await stdout.close();await stderr.close();
   for(let attempt=0;attempt<90;attempt++){if(launchError||child.exitCode!==null)throw Error('ComfyUI no pudo arrancar; consulta el registro local de vídeo.');if(await health())return {running:true,pid:child.pid};await sleep(1000);}
   throw Error('El motor de vídeo no respondió a tiempo.');
  })().finally(()=>starting=null);return starting;
 }
 async function releaseVideoRuntime(){
  const record=await ownedRecord();if(!record)return {stopped:false,reason:'not_owned_or_not_running'};
  if(activePrompt)await api('/interrupt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt_id:activePrompt})}).catch(()=>{});
  if(process.platform==='win32')await run(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(record.pid),'/T','/F'],{timeout:15000}).catch(()=>{});else try{process.kill(record.pid,'SIGTERM');}catch{}
  for(let attempt=0;attempt<30&&alive(record.pid);attempt++)await sleep(100);
  if(alive(record.pid))throw Error('No se pudo liberar el proceso de vídeo.');
  ownChild=null;activePrompt=null;await fs.rm(runtimeFile,{force:true});return {stopped:true};
 }
 async function resolveVideoArtifact(id){
  if(typeof id!=='string'||!ID.test(id))return null;
  try{const base=await fs.realpath(artifacts),file=await fs.realpath(path.join(artifacts,id+'.mp4'));const relative=path.relative(base,file),stat=await fs.stat(file);if(relative.startsWith('..')||path.isAbsolute(relative)||!stat.isFile()||stat.size>25*1024*1024)return null;return {bytes:await fs.readFile(file),mime:'video/mp4',name:id+'.mp4'};}catch{return null;}
 }
 async function generateVideo(prompt,options={}){
  const parameters=videoOptions(options);if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw Error('Describe el vídeo con entre 1 y 2000 caracteres.');
  if(generationBusy)throw Error('Ya hay un vídeo en preparación.');generationBusy=true;
  const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(30*60000)]):AbortSignal.timeout(30*60000);
  const progress=event=>{signal.throwIfAborted();options.onProgress?.(event);};
  const startedAt=Date.now(),id='video-'+Date.now()+'-'+randomUUID().slice(0,8);let socket;
  try{
   if(!await ownedRecord()||!await health())throw Error('Reserva la GPU y arranca el motor de vídeo antes de generar.');
   const clientId=randomUUID();progress({stage:'loading',value:0});
   socket=new WebSocket(origin.replace('http:','ws:')+'/ws?clientId='+clientId);
   socket.addEventListener('message',event=>{try{const data=JSON.parse(String(event.data));if(data.type==='progress'&&(!data.data.prompt_id||data.data.prompt_id===activePrompt))options.onProgress?.({stage:'sampling',value:data.data.value,max:data.data.max});}catch{}});
   const submitted=await api('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:clientId,prompt:wanWorkflow(prompt,id,parameters)}),signal});if(!submitted.prompt_id)throw Error('El motor no aceptó el trabajo de vídeo.');activePrompt=submitted.prompt_id;
   let completed;
   for(;;){signal.throwIfAborted();const history=await api('/history/'+encodeURIComponent(activePrompt),{signal});const entry=history[activePrompt];if(entry?.status?.status_str==='error')throw Error('El modelo de vídeo no pudo ejecutar el flujo local.');if(entry?.status?.completed){completed=entry;break;}await sleep(1500);}
   progress({stage:'encoding',value:1});
   const output=Object.values(completed.outputs||{}).flatMap(value=>[...(value.images||[]),...(value.gifs||[]),...(value.videos||[])]).find(file=>file.type==='output'&&file.subfolder==='atlas'&&typeof file.filename==='string'&&file.filename.startsWith(id+'_')&&/^[A-Za-z0-9_.-]+\.webm$/.test(file.filename));
   if(!output)throw Error('El motor terminó sin un archivo de vídeo válido.');
   const outputRoot=await fs.realpath(path.join(comfyRoot,'output','atlas')),source=await fs.realpath(path.join(outputRoot,output.filename));if(path.dirname(source)!==outputRoot)throw Error('Archivo fuera del directorio de salida.');
   await fs.mkdir(artifacts,{recursive:true});const destination=path.join(artifacts,id+'.mp4');
   const ffmpeg=await run(python,['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{env:environment,signal,timeout:30000});
   await run(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i',source,'-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-movflags','+faststart','-an',destination],{signal,timeout:120000});
   const artifact=await resolveVideoArtifact(id);if(!artifact||artifact.bytes.length<1000)throw Error('No se pudo comprobar el MP4 final.');
   const sha256=createHash('sha256').update(artifact.bytes).digest('hex'),proof={id,provider:'wan21-comfy',model:'Wan2.1 T2V 1.3B',parameters,sha256,bytes:artifact.bytes.length,elapsedMs:Date.now()-startedAt,at:new Date().toISOString()};await fs.writeFile(path.join(artifacts,id+'.json'),JSON.stringify({...proof,prompt},null,2));await fs.writeFile(path.join(mediaRoot,'render-proof.json'),JSON.stringify(proof,null,2));
   progress({stage:'completed',value:1});return {id,provider:'wan21-comfy',model:'Wan2.1 T2V 1.3B',mime:artifact.mime,bytes:artifact.bytes.length,sha256,parameters,elapsedMs:proof.elapsedMs};
  }catch(error){if(activePrompt)await api('/interrupt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt_id:activePrompt})}).catch(()=>{});throw error;}
  finally{socket?.close();activePrompt=null;generationBusy=false;}
 }
 return {videoStatus,startVideoRuntime,generateVideo,releaseVideoRuntime,stopVideoRuntime:releaseVideoRuntime,resolveVideoArtifact};
}
const instance=createVideoTools();
export const {videoStatus,startVideoRuntime,generateVideo,releaseVideoRuntime,stopVideoRuntime,resolveVideoArtifact}=instance;
