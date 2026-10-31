// Adds the cloud project's buildable source. Only reviewed public static seeds
// are retained; runtime D1 records and authentication material are never copied.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),target=path.join(root,'cloud');
const flag=process.argv.indexOf('--source');if(flag<0||!process.argv[flag+1])throw Error('Provide --source <Sites checkout>.');
const source=path.resolve(process.argv[flag+1]);if(source===root||source===target)throw Error('Source and distribution must differ.');
const directories=['app','components','hooks','lib','public','scripts','db','drizzle','build','tests','examples','docs'];
const rootFiles=['.gitignore','.npmrc','.env.example','cloudflare-env.d.ts','components.json','drizzle.config.ts','eslint.config.mjs','next.config.ts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','postcss.config.mjs','tsconfig.json','vite.config.ts'];
const publicSeeds=['archive.json','atlas-lm-seed.json','continuity.json','core.json','native-principles.json','q517-counterexample.json','studio-runtime.json'];
const extensions=new Set(['.tsx','.ts','.mts','.mjs','.cjs','.js','.jsx','.json','.md','.css','.html','.py','.sh','.svg','.sql','.txt','.toml','.yaml','.yml','.d.ts','.LICENSE']);
const deny=new Set(['node_modules','.git','.sites-runtime','.wrangler','.next','.vinext','dist','coverage','data','models','runtime_data','__pycache__','outputs','work','.codex','.agents']);
const patterns={credential:/sk-(?:or-v1|proj)-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,personalEmail:/[A-Z0-9._%+-]+@(?:gmail|outlook|hotmail)\.com/i,personalPath:/[A-Z]:[\\/]{1,2}Users[\\/]{1,2}(?!Public|Default)[A-Za-z0-9._ -]+/i,privateConversation:/https?:\/\/chatgpt\.com\/[^\s"'<>]*\/c\/[0-9a-f-]{25,}|https?:\/\/chatgpt\.com\/c\/[0-9a-f-]{25,}/i};
const records=[];
async function put(relative,original,adapt){
 const text=adapt===undefined?original:adapt;
 for(const [kind,pattern] of Object.entries(patterns))if(pattern.test(text))throw Error(`Cloud export blocked: ${kind} in ${relative}`);
 const destination=path.join(target,relative);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,text);
 records.push({path:relative.replaceAll('\\','/'),bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),adapted:text!==original});
}
async function visit(relative){
 for(const entry of await fs.readdir(path.join(source,relative),{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  const next=path.join(relative,entry.name);
  if(entry.isDirectory()){if(!deny.has(entry.name))await visit(next);continue;}
  if(!entry.isFile()||!extensions.has(path.extname(entry.name))||entry.name.endsWith('.tsbuildinfo'))continue;
  await put(next,await fs.readFile(path.join(source,next),'utf8'));
 }
}
for(const directory of directories)try{await visit(directory);}catch(error){if(error.code!=='ENOENT')throw error;}
for(const name of rootFiles)await put(name,await fs.readFile(path.join(source,name),'utf8'));
await put('.openai/hosting.json',await fs.readFile(path.join(source,'.openai','hosting.json'),'utf8'));
for(const name of ['shadcn-tailwind-4.13.0.css','shadcn-tailwind-4.13.0.LICENSE.md'])await put('vendor/'+name,await fs.readFile(path.join(source,'vendor',name),'utf8'));
for(const name of publicSeeds){
 const original=await fs.readFile(path.join(source,'data',name),'utf8');let text=original;
 if(name==='continuity.json'){
  const seed=JSON.parse(original);seed.conversationUrl='#origen';
  text=JSON.stringify(seed,null,2)+'\n';
 }
 await put('data/'+name,original,text);
}
const readme='# Atlas · interfaz de nube\n\nEsta aplicación Sites/Vinext sirve el chat HTTPS compartible y mantiene una cola D1 con conversaciones separadas por usuario. La ruta `/origen` conserva la interfaz, los documentos estáticos y los experimentos procedurales de la versión original de Sites. El chat nuevo no es aquel pequeño modelo extractivo: envía trabajos al puente saliente del ordenador, que usa Qwen local.\n\n## Arquitectura\n\nEl navegador inicia sesión con ChatGPT y crea un trabajo propio en `/api/cloud`. Un proceso local consulta la cola a través de HTTPS, ejecuta una sesión compartida de Qwen sin acceso a archivos privados ni comandos administrativos del PC y devuelve únicamente la respuesta. No se abren puertos del ordenador. El PC y su servidor Qwen deben permanecer encendidos para responder. GitHub y Sites no proporcionan una GPU Qwen por este despliegue.\n\n## Configuración\n\nInstala las dependencias con el gestor fijado en `packageManager` y conserva el lockfile. El proyecto usa Sites con Cloudflare Workers y D1; `.openai/hosting.json` mantiene la identidad del proyecto original. Un fork debe registrarse como otro Site antes de publicar. Usa el flujo del plugin Sites para aplicar las migraciones y desplegar. No copies `.sites-runtime`, `.env`, bases de datos locales, registros ni credenciales.\n\nEl runtime necesita `ATLAS_BRIDGE_TOKEN` como secreto del alojamiento, nunca en el código cliente. El mismo secreto del puente debe existir solo en el archivo ignorado `continuous/data/cloud-bridge.key` del ordenador. Su archivo `cloud-bridge.json` contiene `{ "siteUrl": "https://tu-site.example" }`. El lanzador local `Start-Cloud-Bridge.ps1` solo arranca cuando ambos archivos existen.\n\n## Verificar\n\nEjecuta `node node_modules/typescript/bin/tsc --noEmit --incremental false` y las pruebas de `tests/` con el comando de tipos compatible con tu Node. El build se realiza con `npm run build` dentro de esta carpeta o con el helper de compilación de Sites. No se instala un servidor GPU en la nube automáticamente.\n\n## Datos de semilla y licencias\n\n`data/` contiene únicamente siete semillas estáticas de la versión original ya publicada, necesarias para compilar `/origen`; no son conversaciones D1 ni memoria del PC. Se quitó el enlace identificador de la conversación privada de la semilla de continuidad. Se conservan CSS y avisos de licencia del starter. Las migraciones y sus metadatos se mantienen íntegros. La copia de código no concede una licencia nueva a componentes o modelos de terceros.\n';
await put('README.md',await fs.readFile(path.join(source,'README.md'),'utf8'),readme);
await fs.writeFile(path.join(root,'docs','cloud-export-manifest.json'),JSON.stringify({schema:1,createdAt:new Date().toISOString(),scope:'Reviewed source plus original published static seeds; excludes live runtime records.',files:records,totalBytes:records.reduce((sum,entry)=>sum+entry.bytes,0),scan:{findings:0,privateConversationLinksRemoved:1},staticSeeds:publicSeeds},null,2)+'\n');
console.log(JSON.stringify({cloudFiles:records.length,bytes:records.reduce((sum,entry)=>sum+entry.bytes,0),sensitiveFindings:0,privateConversationLinksRemoved:1}));
