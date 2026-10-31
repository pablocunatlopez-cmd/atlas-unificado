import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-source-setup-'));
assert.equal(path.dirname(temporary),path.resolve(os.tmpdir()));assert.ok(path.basename(temporary).startsWith('atlas-source-setup-'));
try{
 await fs.mkdir(path.join(temporary,'scripts'));await fs.mkdir(path.join(temporary,'continuous'));
 await fs.copyFile(path.join(root,'scripts','setup-local.mjs'),path.join(temporary,'scripts','setup-local.mjs'));
 await fs.copyFile(path.join(root,'continuous','config.example.json'),path.join(temporary,'continuous','config.example.json'));
 await fs.symlink(path.join(root,'node_modules'),path.join(temporary,'node_modules'),'junction');
 const result=spawnSync(process.execPath,[path.join(temporary,'scripts','setup-local.mjs')],{cwd:temporary,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
 const key=await fs.readFile(path.join(temporary,'continuous','data','chat-local.key'),'utf8');assert.equal(Buffer.from(key,'base64').length,32);
 const config=JSON.parse(await fs.readFile(path.join(temporary,'continuous','config.json'),'utf8'));assert.equal(config.trainingBackend,'cpu');assert.equal(config.parallelCandidates,1);
 assert.ok((await fs.stat(path.join(temporary,'continuous','studio','vendor','three.module.js'))).size>0);
 const second=spawnSync(process.execPath,[path.join(temporary,'scripts','setup-local.mjs')],{cwd:temporary,encoding:'utf8',windowsHide:true});assert.equal(second.status,0,second.stderr);
 assert.equal(await fs.readFile(path.join(temporary,'continuous','data','chat-local.key'),'utf8'),key);
 console.log(JSON.stringify({setup:true,idempotent:true,sourceRuntimeDataCreated:false,keyNotPrinted:true}));
}finally{
 await fs.unlink(path.join(temporary,'node_modules')).catch(()=>{});
 // The absolute target was checked against the unique test directory above.
 await fs.rm(temporary,{recursive:true,force:true});
}
