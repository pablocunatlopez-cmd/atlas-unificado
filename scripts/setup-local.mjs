import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),service=path.join(root,'continuous'),data=path.join(service,'data');
await fs.mkdir(data,{recursive:true});
try{await fs.writeFile(path.join(data,'chat-local.key'),randomBytes(32).toString('base64'),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
const configuration=JSON.parse(await fs.readFile(path.join(service,'config.example.json'),'utf8'));
if(process.env.ATLAS_GPU_PYTHON)configuration.gpuPython=process.env.ATLAS_GPU_PYTHON;
try{await fs.writeFile(path.join(service,'config.json'),JSON.stringify(configuration,null,2)+'\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
const vendor=path.join(service,'studio','vendor');await fs.mkdir(vendor,{recursive:true});
for(const name of ['three.module.js','three.core.js'])await fs.copyFile(path.join(root,'node_modules','three','build',name),path.join(vendor,name));
await fs.copyFile(path.join(root,'node_modules','three','LICENSE'),path.join(vendor,'LICENSE'));
console.log('Runtime vacío preparado. Configura llama.cpp en 127.0.0.1:11435 con alias atlas-local y la clave local generada. No se han importado datos privados.');
