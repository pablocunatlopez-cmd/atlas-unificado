import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'continuous');
const files=(await fs.readdir(dir)).filter(name=>name.endsWith('.test.mjs')).map(name=>path.join(dir,name));
const child=spawn(process.execPath,['--test','--test-timeout=60000',...files,path.join(dir,'studio','logic.test.mjs')],{stdio:'inherit',cwd:root,windowsHide:true});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});child.once('exit',code=>process.exitCode=code??1);
