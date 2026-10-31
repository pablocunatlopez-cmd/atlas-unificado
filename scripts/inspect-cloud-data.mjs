import fs from 'node:fs/promises';
import path from 'node:path';
const source=process.argv[2];if(!source)throw Error('Provide source directory');
const patterns={credential:/sk-(?:or-v1|proj)-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,email:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,personalPath:/[A-Z]:[\\/]{1,2}Users[\\/]{1,2}(?!Public|Default)[A-Za-z0-9._ -]+/i,chatId:/\b(?:01a[0-9a-f]{5}-[0-9a-f-]{20,}|6[a-f0-9]{7}-[0-9a-f-]{20,})\b/i};
for(const name of await fs.readdir(path.join(source,'data'))){if(!name.endsWith('.json'))continue;const value=JSON.parse(await fs.readFile(path.join(source,'data',name),'utf8'));const result={name,topKeys:Object.keys(value).slice(0,30),strings:0,findings:[]};
 const visit=(item,location)=>{if(typeof item==='string'){result.strings++;for(const [kind,pattern] of Object.entries(patterns))if(pattern.test(item))result.findings.push({kind,path:location});}else if(item&&typeof item==='object')for(const [key,next] of Object.entries(item))visit(next,location+'.'+key);};visit(value,'$');console.log(JSON.stringify(result));}
