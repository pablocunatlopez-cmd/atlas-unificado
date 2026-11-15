#!/usr/bin/env node
// ERAS is the canonical engine. Only these versioned modules are mirrored into
// Atlas; the data adapter/UI are Atlas code and must never be silently replaced.
import {readFile,writeFile,mkdir,lstat,realpath,rename,rm,mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const files=['render-engine.js','gpu-renderer.js','cinematography.js','graphics.js','vendor/BloomNode.js','vendor/BufferGeometryUtils.js','vendor/DepthOfFieldNode.js','vendor/FXAANode.js','vendor/GLTFLoader.js','vendor/GTAONode.js','vendor/GaussianBlurNode.js','vendor/HDRLoader.js','vendor/THREE-LICENSE.txt','vendor/three.core.js','vendor/three.module.js','vendor/three.tsl.js','vendor/three.webgpu.js'];
const projectId='appgprj_6ad66800b1888191b0fc84e227cad74f',root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),destination=path.join(root,'public/eras-engine'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const args=process.argv.slice(2);let write=false,explicitSource=false,source=path.resolve(root,'../eras');
function fail(message){throw Error(message);}
for(let i=0;i<args.length;i++){if(args[i]==='--check')continue;if(args[i]==='--write'){write=true;continue;}if(args[i]==='--source'&&args[i+1]){source=path.resolve(args[++i]);explicitSource=true;continue;}fail('Uso: node scripts/sync-eras-engine.mjs [--check | --write] [--source /ruta/al/repositorio/eras]');}
async function exists(file){try{await lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function regular(file){const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())fail('Solo se admiten archivos regulares: '+path.basename(file));return readFile(file);}
function git(...args){return execFileSync('git',['-C',source,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
async function verifyLocal(){
 const manifest=JSON.parse((await regular(path.join(destination,'provenance.json'))).toString());
 if(manifest.engine!=='ERAS'||manifest.projectId!==projectId||!/^[a-f0-9]{40}$/.test(manifest.commit)||!Array.isArray(manifest.files)||manifest.files.length!==files.length)fail('El manifiesto ERAS no tiene una procedencia válida.');
 for(const name of files){const matches=manifest.files.filter(f=>f.path===name);if(matches.length!==1||matches[0].source!=='dist/'+name||!/^[a-f0-9]{64}$/.test(matches[0].sha256))fail('Inventario de módulos ERAS inconsistente: '+name);const bytes=await regular(path.join(destination,name));if(hash(bytes)!==matches[0].sha256)fail('Un módulo local cambió sin sincronizar su procedencia: '+name);}
 return manifest;
}
async function inspectSource(){
 if(!await exists(source)){if(explicitSource||write)fail('El repositorio ERAS no está disponible; no se puede escribir ni acreditar su revisión.');return null;}
 source=await realpath(source);const gitRoot=path.resolve(git('rev-parse','--show-toplevel'));if(gitRoot!==source)fail('La fuente debe ser la raíz exacta del repositorio ERAS.');
 if(git('status','--porcelain'))fail('ERAS tiene cambios sin confirmar. Confirma una revisión limpia antes de sincronizar el motor.');
 if(await exists(path.join(source,'.openai/hosting.json'))){const hosting=JSON.parse((await regular(path.join(source,'.openai/hosting.json'))).toString());if(hosting.project_id!==projectId)fail('La fuente pertenece a otro proyecto de Sites.');}
 const commit=git('rev-parse','HEAD');if(!/^[a-f0-9]{40}$/.test(commit))fail('La revisión de ERAS no es válida.');
 const modules=[];
 for(const name of files){const relative='dist/'+name;git('ls-files','--error-unmatch','--',relative);const bytes=await regular(path.join(source,relative));const committed=execFileSync('git',['-C',source,'show',commit+':'+relative],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});if(!bytes.equals(committed))fail('La fuente no coincide con el commit declarado: '+relative);modules.push({name,bytes,sha256:hash(bytes)});}
 return{commit,modules};
}
try{
 const canonical=await inspectSource();
 if(write){
  if(!canonical)fail('Falta el repositorio canónico de ERAS.');
  await mkdir(destination,{recursive:true});const staged=await mkdtemp(path.join(destination,'.sync-'));
  try{
   for(const module of canonical.modules){const target=path.join(destination,module.name);if(await exists(target)&&!(await lstat(target)).isFile())fail('Destino de módulo no regular: '+module.name);await mkdir(path.dirname(path.join(staged,module.name)),{recursive:true});await writeFile(path.join(staged,module.name),module.bytes);}
   for(const module of canonical.modules){await mkdir(path.dirname(path.join(destination,module.name)),{recursive:true});await rename(path.join(staged,module.name),path.join(destination,module.name));}
   const manifest={version:1,engine:'ERAS',projectId,commit:canonical.commit,scope:'Renderer, GPU pipeline and cinematography are exact copies from ERAS. The scene adapter accepts data only; this is not the original game runtime or neural video generation.',files:canonical.modules.map(m=>({path:m.name,source:'dist/'+m.name,sha256:m.sha256}))};await writeFile(path.join(staged,'provenance.json'),JSON.stringify(manifest,null,2)+'\n');await rename(path.join(staged,'provenance.json'),path.join(destination,'provenance.json'));
  }finally{await rm(staged,{recursive:true,force:true});}
 }
 const manifest=await verifyLocal();
 if(canonical){if(manifest.commit!==canonical.commit)fail('El motor local apunta a otra revisión. Revisa los cambios y usa --write para sincronizar.');for(const m of canonical.modules)if(manifest.files.find(f=>f.path===m.name)?.sha256!==m.sha256)fail('El módulo no coincide con ERAS: '+m.name);}
 process.stdout.write(JSON.stringify({ok:true,mode:write?'write':'check',engine:'ERAS',commit:manifest.commit,files:files.length,verification:canonical?'canonical-repository-and-local-hashes':'local-manifest-hashes-only',note:canonical?'Los módulos coinciden con el repositorio ERAS limpio y su commit.':'El repositorio ERAS no está presente. Se verificó la coherencia local; no se ha verificado el origen externo.'})+'\n');
}catch(error){process.stderr.write('ERAS sync: '+error.message+'\n');process.exitCode=1;}
