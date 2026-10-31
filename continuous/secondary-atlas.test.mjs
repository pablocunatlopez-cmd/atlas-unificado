import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createSecondaryAtlas, runBoundedCommand } from './secondary-atlas.mjs';
import { DatabaseSync } from 'node:sqlite';

async function temporary(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-secondary-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; }
async function fixture(t) {
  const root = await temporary(t), componentRoot = path.join(root, 'components', 'atlas597');
  await fs.mkdir(componentRoot, { recursive: true });
  await fs.writeFile(path.join(componentRoot, 'atlas_bridge.py'), 'bridge');
  return { root, componentRoot };
}

test('bounded process requires clean JSON and handles missing executable and bad output', async () => {
  await assert.rejects(runBoundedCommand('Z:/atlas-no-such-python.exe', []), /ENOENT/);
  await assert.rejects(runBoundedCommand(process.execPath, ['-e', 'process.stdout.write("not-json")']), /JSON inválida/);
  await assert.rejects(runBoundedCommand(process.execPath, ['-e', 'process.stderr.write("meaningful failure");process.exit(7)']), /salida 7.*meaningful failure/);
  assert.deepEqual(await runBoundedCommand(process.execPath, ['-e', 'process.stdin.resume();process.stdin.on("end",()=>console.log(JSON.stringify({ok:true})))']), { ok: true });
});

test('bounded process enforces timeout, output cap and cancellation', async () => {
  await assert.rejects(runBoundedCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 100 }), /Tiempo máximo/);
  await assert.rejects(runBoundedCommand(process.execPath, ['-e', 'console.log("x".repeat(10000))'], { maxOutputBytes: 1000 }), /demasiado grande/);
  const controller = new AbortController(); const work = runBoundedCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: controller.signal });
  controller.abort(new Error('manual stop')); await assert.rejects(work, /manual stop/);
});

test('fixed action interface rejects user commands, paths, and unbounded training', async t => {
  const setup = await fixture(t), calls = [];
  const lab = createSecondaryAtlas({ ...setup, pythonPath: process.execPath, runProcess: async (...args) => { calls.push(args); return { ok: true }; } });
  await assert.rejects(lab.runSecondary('exec', { command: 'anything' }), /no permitida/);
  await assert.rejects(lab.runSecondary('decision', { question: '' }), /Pregunta/);
  await assert.rejects(lab.runSecondary('train', { steps: 401 }), /Pasos/);
  await assert.rejects(lab.runSecondary('train', { batch: 2000 }), /Pasos/);
  const result = await lab.runSecondary('game', { prompt: 'Un mundo de plataformas', id: '../../outside', root: 'C:/' });
  assert.match(result.artifactUrl, /^\/project\/artifacts\/game-\d+-[a-f0-9]{8}\/index.html$/);
  assert.equal(calls.length, 1);
  const [executable, args, options] = calls[0];
  assert.equal(executable, process.execPath); assert.deepEqual(args.slice(-1), ['game']);
  assert.equal(options.env.ATLAS_INFERENCE_DEVICE, 'cpu'); assert.equal(options.env.CUDA_VISIBLE_DEVICES, '');
  assert.equal(options.env.ATLAS_SECONDARY_ROOT, path.join(setup.root, 'data', 'secondary'));
  const payload = JSON.parse(options.input); assert.equal(payload.root, undefined); assert.notEqual(payload.id, '../../outside');
});

test('artifacts only resolve known generated files within canonical directory', async t => {
  const setup = await fixture(t), lab = createSecondaryAtlas({ ...setup, pythonPath: process.execPath });
  const id = 'game-1793470000000-aabbccdd';
  const target = path.join(setup.root, 'data', 'secondary', 'games', id, 'prototype'); await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'index.html'), '<canvas></canvas>');
  const file = await lab.resolveSecondaryArtifact(`${id}/index.html`); assert.equal(file.bytes.toString(), '<canvas></canvas>');
  assert.equal(file.mime, 'text/html; charset=utf-8');
  for (const bad of ['../index.html', `${id}/launch_server.py`, `${id}/../index.html`, `${id}\\index.html`, `${id}/%2e%2e`, `games/${id}/../../config.json`]) assert.equal(await lab.resolveSecondaryArtifact(bad), null);
  const outside = path.join(setup.root, 'outside'); await fs.mkdir(outside); await fs.writeFile(path.join(outside, 'game.js'), 'sensitive');
  try { await fs.symlink(path.join(outside, 'game.js'), path.join(target, 'game.js')); assert.equal(await lab.resolveSecondaryArtifact(`${id}/game.js`), null); }
  catch (error) { if (error.code !== 'EPERM') throw error; }
});

test('status reports stale process as interrupted and experimental model honestly', async t => {
  const setup = await fixture(t), lab = createSecondaryAtlas({ ...setup, pythonPath: process.execPath });
  const control = path.join(setup.root, 'data', 'secondary', 'autonomy'); await fs.mkdir(control, { recursive: true });
  await fs.writeFile(path.join(control, 'status.json'), JSON.stringify({ status: 'running', pid: -1, phase: 'training' }));
  const status = await lab.secondaryStatus(); assert.equal(status.status, 'interrupted');
  assert.equal(status.model.conversational, false); assert.equal(status.model.qwenWeightsChanged, false); assert.equal(status.available, false);
  assert.equal(status.runtime.device, 'cpu'); assert.deepEqual(status.actions, ['status', 'decision', 'game', 'train', 'stop']);
  assert.equal((await lab.runSecondary('stop')).status, 'not_running');
});

test('concurrent training requests reserve one process, preserve stop and report stopped', async t => {
  const setup = await fixture(t); let launched = 0, finish;
  const lab = createSecondaryAtlas({ ...setup, pythonPath: process.execPath, runProcess: (_command, _args, options) => {
    launched += 1; options.onSpawn(process.pid);
    return new Promise(resolve => { finish = resolve; });
  } });
  const results = await Promise.all(Array.from({ length: 12 }, () => lab.runSecondary('train', { steps: 2, batch: 1 })));
  assert.equal(launched, 1); assert.equal(results.filter(result => result.status === 'accepted').length, 1);
  assert.equal(results.filter(result => result.status === 'already_running').length, 11);
  assert.equal((await lab.runSecondary('stop')).status, 'stop_requested');
  assert.ok(await fs.readFile(path.join(setup.root, 'data', 'secondary', 'autonomy', 'stop.request'), 'utf8'));
  finish({ status: 'stopped', run_id: 'test-run' });
  for (let i = 0; i < 50; i++) { const job = JSON.parse(await fs.readFile(path.join(setup.root, 'data', 'secondary', 'process.json'))); if (job.status === 'stopped') break; await new Promise(resolve => setTimeout(resolve, 5)); }
  const job = JSON.parse(await fs.readFile(path.join(setup.root, 'data', 'secondary', 'process.json'))); assert.equal(job.status, 'stopped');
});

test('imported memory retrieval binds FTS terms, excludes conversations and caps reference text', async t => {
  const setup = await fixture(t), lab = createSecondaryAtlas({ ...setup, pythonPath: process.execPath });
  const memory = path.join(setup.componentRoot, 'memory'); await fs.mkdir(memory);
  const file = path.join(memory, 'portable-atlas-memory.sqlite3'), db = new DatabaseSync(file);
  db.exec(`CREATE TABLE documents(id TEXT PRIMARY KEY,title TEXT,source TEXT,sha256 TEXT,active INTEGER);
    CREATE TABLE chunks(id INTEGER PRIMARY KEY,document_id TEXT,text TEXT,start_line INTEGER,end_line INTEGER);
    CREATE VIRTUAL TABLE chunk_search USING fts5(text,content='chunks',content_rowid='id');
    CREATE TABLE turns(question TEXT,answer TEXT);`);
  db.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run('a', 'Arquitectura Atlas', 'https://example.org/atlas', 'abc', 1);
  for (let i = 1; i <= 4; i++) { const text = `Arquitectura refutacion ${'referencia '.repeat(300)}`; db.prepare('INSERT INTO chunks VALUES(?,?,?,?,?)').run(i, 'a', text, i, i); db.prepare('INSERT INTO chunk_search(rowid,text) VALUES(?,?)').run(i, text); }
  db.prepare('INSERT INTO turns VALUES(?,?)').run('arquitectura', 'PRIVATE CONVERSATION'); db.close();
  const before = await fs.readFile(file);
  const result = await lab.searchSecondaryMemory('Arquitectura OR " UNION SELECT turns --', { limit: 4 });
  assert.ok(result.length); assert.ok(result.reduce((sum, row) => sum + row.text.length, 0) <= 3000);
  assert.ok(result.every(row => row.provenance === 'imported-atlas597-memory' && row.verified === false && row.evidence === 'unverified'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE CONVERSATION'));
  assert.equal(result[0].url, 'https://example.org/atlas');
  assert.deepEqual(await lab.searchSecondaryMemory('de la que'), []); assert.deepEqual(await lab.searchSecondaryMemory(''), []);
  assert.deepEqual(await fs.readFile(file), before);
});
