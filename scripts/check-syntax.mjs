import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['continuous', 'scripts'];
const excluded = new Set(['node_modules', '.git', 'data']);
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, {withFileTypes:true})) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !excluded.has(entry.name)) await walk(full);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(full);
  }
}
for (const name of roots) await walk(path.join(root,name));
files.sort();
if (!files.length) throw Error('No JavaScript modules found');
let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {encoding:'utf8',timeout:10000});
  if (result.status !== 0) {
    failures++;
    console.error(path.relative(root,file),result.error?.message||result.stderr||'Syntax check failed');
  }
}
console.log(`Checked ${files.length} JavaScript modules; ${failures} failures`);
if (failures) process.exitCode = 1;
