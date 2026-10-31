// Validates the independent cloud source with an existing dependency install.
// The temporary junction is removed before any upload manifest is produced.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cloud=path.join(root,'cloud');
const flag=process.argv.indexOf('--dependencies');if(flag<0||!process.argv[flag+1])throw Error('Provide --dependencies <existing node_modules>.');
const dependencyRoot=path.resolve(process.argv[flag+1]),junction=path.join(cloud,'node_modules');
await fs.symlink(dependencyRoot,junction,'junction');
try{
 const typecheck=spawnSync(process.execPath,[path.join(junction,'typescript','bin','tsc'),'--noEmit','--incremental','false'],{cwd:cloud,encoding:'utf8',windowsHide:true,maxBuffer:2000000});
 assert.equal(typecheck.status,0,typecheck.stdout+typecheck.stderr);
 const queue=spawnSync(process.execPath,['--test','lib/cloud/queue.test.mjs'],{cwd:cloud,encoding:'utf8',windowsHide:true,maxBuffer:2000000});
 assert.equal(queue.status,0,queue.stdout+queue.stderr);
 console.log(JSON.stringify({typecheck:true,queueTests:true,privateRuntimeCopied:false,dependencyJunctionTemporary:true}));
}finally{await fs.unlink(junction);}
