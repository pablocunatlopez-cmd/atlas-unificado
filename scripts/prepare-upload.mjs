// Produces the exact source allowlist for a GitHub commit. No ignored runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const permittedRoots=new Set(['continuous','public','scripts','docs','cloud']);
const permittedRootFiles=new Set(['README.md','AGENTS.md','package.json','package-lock.json','.gitignore','.env.example']);
const deniedDirectories=new Set(['node_modules','.git','data','models','runtime_data','memory','evidence','original-launchers','__pycache__','.venv','.venv-gpu','vendor','verification','dist','.next','.vinext','.wrangler','.sites-runtime','coverage','outputs','work','.codex','.agents']);
const permittedExtensions=new Set(['.mjs','.cjs','.js','.ts','.mts','.tsx','.jsx','.py','.json','.md','.html','.css','.ps1','.vbs','.txt','.sql','.sh','.toml','.yml','.yaml','.svg']);
const publicCloudSeeds=new Set(['archive.json','atlas-lm-seed.json','continuity.json','core.json','native-principles.json','q517-counterexample.json','studio-runtime.json']);
const entries=[];
async function visit(directory,relative=''){
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('Symlink excluded from export: '+relative+'/'+entry.name);
  const next=path.join(relative,entry.name).replaceAll('\\','/');
  if(!relative&&!permittedRoots.has(entry.name)&&!permittedRootFiles.has(entry.name))continue;
  if(entry.isDirectory()){if(!deniedDirectories.has(entry.name)||(relative==='cloud'&&['data','vendor'].includes(entry.name)))await visit(path.join(directory,entry.name),next);continue;}
  if(!entry.isFile()||next==='docs/github-upload-manifest.json'||/\.(?:key|log|sqlite\d?|gguf|pt|zip)$/i.test(entry.name))continue;
  if(entry.name.startsWith('.env')&&entry.name!=='.env.example')continue;
  if(relative==='cloud/data'&&!publicCloudSeeds.has(entry.name))continue;
  if(relative==='cloud/vendor'&&!['shadcn-tailwind-4.13.0.css','shadcn-tailwind-4.13.0.LICENSE.md'].includes(entry.name))continue;
  if(!permittedRootFiles.has(entry.name)&&!permittedExtensions.has(path.extname(entry.name))&&next!=='cloud/.npmrc'&&!/^(?:LICENSE|.*\.LICENSE)$/i.test(entry.name))continue;
  const bytes=await fs.readFile(path.join(directory,entry.name));
  if(bytes.includes(0))throw Error('Binary file excluded from source export: '+next);
  entries.push({path:next,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
}
await visit(root);entries.sort((a,b)=>a.path.localeCompare(b.path));
const manifest={schema:1,createdAt:new Date().toISOString(),files:entries,totalBytes:entries.reduce((sum,file)=>sum+file.bytes,0),excluded:['Runtime data','Models and checkpoints','Secrets and local configuration','node_modules and restored vendor assets','Private memories, reports and source-machine paths']};
await fs.writeFile(path.join(root,'docs','github-upload-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:entries.length,totalBytes:manifest.totalBytes,privateDataIncluded:false}));
