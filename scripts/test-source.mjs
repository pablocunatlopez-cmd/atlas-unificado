import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'continuous');

async function discoverTests(folder) {
  const entries = await fs.readdir(folder, {withFileTypes: true});
  const tests = [];
  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      tests.push(...await discoverTests(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      tests.push(fullPath);
    }
  }
  return tests;
}

const files = (await discoverTests(dir)).sort();
if (files.length === 0) {
  console.error('No test files found in continuous/. Refusing to report success.');
  process.exitCode = 1;
} else {
  console.log(`Running ${files.length} Atlas test files`);
  const child = spawn(process.execPath, ['--test', '--test-timeout=60000', ...files], {
    stdio: 'inherit',
    cwd: root,
    windowsHide: true,
  });
  child.once('error', error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) console.error(`Test runner terminated by signal ${signal}`);
    process.exitCode = code === 0 && !signal ? 0 : 1;
  });
}
