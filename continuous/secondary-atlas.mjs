import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PYTHON = process.env.ATLAS_LAB_PYTHON || path.join(ROOT, '..', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const ACTIONS = Object.freeze(['status', 'decision', 'game', 'train', 'stop']);
const ARTIFACTS = Object.freeze({ 'index.html': 'text/html; charset=utf-8', 'style.css': 'text/css; charset=utf-8', 'game.js': 'text/javascript; charset=utf-8', 'README.md': 'text/plain; charset=utf-8' });

async function readJson(file, fallback = null) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
function alive(pid) { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } }
async function atomicJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`; await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`); await fs.rename(tmp, file); }
function killTree(child) {
  if (!Number.isInteger(child?.pid) || child.pid <= 0 || process.platform !== 'win32') return Promise.resolve(false);
  return new Promise(resolve => {
    try { execFile(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 500, killSignal: 'SIGKILL' }, error => resolve(!error)); }
    catch { resolve(false); }
  });
}
function boundedResult(work, milliseconds) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => finish(false), milliseconds);
    Promise.resolve(work).then(finish, () => finish(false));
  });
}
// Internal lifecycle helper exported for deterministic closed-child tests.
export async function terminateChild(child, terminateTree) {
  let childExited = child.exitCode !== null || child.signalCode !== null, directKillRequested = false;
  let reportExit;
  const exited = new Promise(resolve => reportExit = resolve);
  const onExit = () => { childExited = true; reportExit(true); };
  child.once('exit', onExit);
  try {
    // Only this spawn's PID is eligible. Tree cleanup can fail in a sandbox;
    // its failure must not leave the direct child and inherited pipes alive.
    const treeCommandSucceeded = !childExited && await boundedResult(Promise.resolve().then(() => childExited ? false : terminateTree(child)), 200) === true;
    if (!childExited) { try { directKillRequested = child.kill('SIGKILL'); } catch {} }
    if (!childExited) await boundedResult(exited, 500);
    return { treeCommandSucceeded, directKillRequested, childExited, stdioDetached: true, entireTreeVerified: false };
  } finally {
    child.removeListener('exit', onExit);
    for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.destroy();
    child.unref();
  }
}

/** Internal process primitive; HTTP callers only reach the fixed action enum. */
export function runBoundedCommand(command, args, { cwd, env, input = '', signal, timeoutMs = 90_000, maxOutputBytes = 1_000_000, onSpawn, terminateTree = killTree } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('Operación cancelada'));
    let child, timer, settled = false, terminating = false, bytes = 0, out = '', err = '';
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(result); };
    const stop = reason => {
      if (settled || terminating) return;
      terminating = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      void terminateChild(child, terminateTree).then(cleanup => {
        const error = new Error(reason?.message || String(reason || 'Operación cancelada'), { cause: reason });
        error.cleanup = cleanup; finish(error);
      }, problem => finish(new Error('No se pudo completar la limpieza del laboratorio', { cause: problem })));
    };
    const abort = () => stop(signal?.reason || new Error('Operación cancelada'));
    try { child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (error) { finish(error); return; }
    child.once('error', error => { if (!terminating) finish(error); });
    child.once('spawn', () => { try { onSpawn?.(child.pid); } catch (error) { stop(error); } });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { bytes += Buffer.byteLength(chunk); if (bytes > maxOutputBytes) stop(new Error('Salida del laboratorio demasiado grande')); else out += chunk; });
    child.stderr.on('data', chunk => { err = (err + chunk).slice(-8000); });
    child.stdin.on('error', () => {});
    child.once('close', (code, stoppedBy) => {
      if (terminating) return;
      if (code !== 0) return finish(new Error(`Laboratorio local: salida ${code ?? stoppedBy}. ${err.slice(-1800)}`));
      try { const result = JSON.parse(out); if (result.ok === false) return finish(new Error(result.error || 'Error del laboratorio')); finish(null, result); }
      catch (error) { finish(new Error(`Respuesta JSON inválida del laboratorio: ${error.message}`)); }
    });
    timer = setTimeout(() => stop(new Error('Tiempo máximo del laboratorio agotado')), timeoutMs);
    timer.unref?.(); signal?.addEventListener('abort', abort, { once: true });
    child.stdin.end(input);
  });
}

export function createSecondaryAtlas({ root = ROOT, componentRoot = path.join(root, 'components', 'atlas597'), pythonPath = DEFAULT_PYTHON, runProcess = runBoundedCommand } = {}) {
  const data = path.join(root, 'data', 'secondary');
  const control = path.join(data, 'autonomy');
  const bridge = path.join(componentRoot, 'atlas_bridge.py');
  const jobPath = path.join(data, 'process.json');
  let activeJob = null, foregroundBusy = false, trainingStarting = false, stopGeneration = 0;
  const env = { ...process.env, ATLAS_DATA_ROOT: data, ATLAS_SECONDARY_ROOT: data, ATLAS_PRESERVE_STOP_REQUEST: '1', ATLAS_INFERENCE_DEVICE: 'cpu', CUDA_VISIBLE_DEVICES: '', OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2', PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
  async function invoke(action, payload, options = {}) {
    return runProcess(pythonPath, ['-B', bridge, action], { cwd: componentRoot, env, input: JSON.stringify(payload), ...options });
  }
  async function secondaryStatus() {
    const [runtimeAvailable, manifest, status, job, review, modelConfig] = await Promise.all([
      exists(pythonPath), readJson(path.join(componentRoot, 'snapshot-manifest.json')), readJson(path.join(control, 'status.json')),
      readJson(jobPath), readJson(path.join(componentRoot, 'eval', 'promotion_review_511.json')),
      readJson(path.join(componentRoot, 'models', 'atlas-lm-0.3-decision-nano-v2', 'config.json')),
    ]);
    const modelAvailable = !!modelConfig && await exists(path.join(componentRoot, 'models', 'atlas-lm-0.3-decision-nano-v2', 'model.pt')) && await exists(path.join(componentRoot, 'models', 'atlas-lm-0.3-decision-nano-v2', 'tokenizer.json'));
    const ready = !!manifest && runtimeAvailable && modelAvailable && await exists(bridge);
    const importedMemory = await readJson(path.join(componentRoot, 'memory', 'import-manifest.json'));
    const gameEntries = await fs.readdir(path.join(data, 'games'), { withFileTypes: true }).catch(() => []);
    const running = !!job && job.status === 'running' && alive(job.pid);
    const labState = status && (status.pid === job?.pid || !running) ? { ...status, process_alive: alive(status.pid) } : null;
    if (labState && ['running', 'preparing', 'auditing'].includes(labState.status) && !labState.process_alive) labState.status = 'interrupted';
    return { available: ready, component: 'atlas597', canonical: root, runtime: { available: runtimeAvailable, executable: pythonPath, device: 'cpu', maxThreads: 2, externalEnvironment: true },
      model: { name: 'ATLAS-LM decision nano v2', parameters: 117568, conversational: false, qwenWeightsChanged: false, available: modelAvailable, contextTokens: modelConfig?.max_seq_len || null },
      status: running ? 'running' : labState?.status || 'not_started', training: labState, process: job ? { pid: job.pid, process_alive: alive(job.pid), status: running ? 'running' : job.status === 'running' ? 'interrupted' : job.status, action: job.action, startedAt: job.startedAt, error: job.error || null } : null,
      snapshot: manifest ? { importedAt: manifest.importedAt, files: manifest.files?.length || 0, manifestSha256: createHash('sha256').update(await fs.readFile(path.join(componentRoot, 'snapshot-manifest.json'))).digest('hex') } : null,
      memory: importedMemory ? { snapshots: importedMemory.imports.length, documents: importedMemory.imports.reduce((sum, entry) => sum + (entry.counts?.documents || 0), 0), chunks: importedMemory.imports.reduce((sum, entry) => sum + (entry.counts?.chunks || 0), 0), preservedTurns: importedMemory.imports.reduce((sum, entry) => sum + (entry.counts?.turns || 0), 0), retrievedAs: 'unverified-reference', writable: false } : null,
      artifacts: { games: gameEntries.filter(entry => entry.isDirectory() && /^game-\d{10,16}-[a-f0-9]{8}$/.test(entry.name)).length },
      previousEvaluation: review ? { status: review.status, activated: false, candidateCorrect: review.candidate_correct, baselineCorrect: review.baseline_correct, total: review.total, reasons: review.reasons } : null,
      actions: ACTIONS, limitations: ['Clasificador experimental de decisiones, no modelo conversacional general.', 'Entrenamiento sintético en CPU; no modifica Qwen ni activa pesos automáticamente.', 'Prototipos de videojuegos 2D mediante plantilla; no gráficos AAA.', 'El entorno Python se conserva en la ubicación original y se requiere para ejecutar el laboratorio.'] };
  }
  async function runSecondary(action, payload = {}, { signal } = {}) {
    if (!ACTIONS.includes(action)) throw new Error('Acción del laboratorio no permitida');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Se esperaba un objeto de parámetros');
    if (action === 'status') return secondaryStatus();
    if (action === 'stop') {
      stopGeneration += 1;
      const job = await readJson(jobPath); if (!trainingStarting && !activeJob && !(job?.status === 'running' && alive(job.pid))) return { status: 'not_running', localOnly: true };
      await fs.mkdir(control, { recursive: true }); await fs.writeFile(path.join(control, 'stop.request'), new Date().toISOString());
      return { status: 'stop_requested', message: 'Parada solicitada; el laboratorio guardará su checkpoint.', localOnly: true };
    }
    if (!await exists(pythonPath) || !await exists(bridge)) throw new Error('El entorno Python local del laboratorio no está disponible');
    if (action === 'train') {
      if (trainingStarting) return { status: 'already_running', pid: activeJob?.pid || null, localOnly: true };
      trainingStarting = true;
      const generationAtStart = stopGeneration;
      try {
      const previous = await readJson(jobPath);
      if (activeJob || (previous?.status === 'running' && alive(previous.pid))) return { status: 'already_running', pid: previous?.pid || activeJob?.pid, localOnly: true };
      const steps = payload.steps ?? 100, batch = payload.batch ?? 4;
      if (!Number.isInteger(steps) || steps < 1 || steps > 400 || !Number.isInteger(batch) || batch < 1 || batch > 8) throw new Error('Pasos entre 1 y 400 y lote entre 1 y 8');
      const job = { action: 'train', id: randomUUID(), status: 'starting', startedAt: new Date().toISOString(), pid: null };
      await fs.mkdir(control, { recursive: true });
      // A stop from an earlier completed session must not cancel the new session.
      await fs.rm(path.join(control, 'stop.request'), { force: true });
      if (generationAtStart !== stopGeneration) throw new Error('Inicio cancelado por una solicitud de parada');
      let startedResolve, startedReject, initialWrite = Promise.resolve();
      const started = new Promise((resolve, reject) => { startedResolve = resolve; startedReject = reject; });
      activeJob = job;
      const work = invoke('train', { steps, batch }, { timeoutMs: 420_000, signal, onSpawn: pid => { job.pid = pid; job.status = 'running'; initialWrite = atomicJson(jobPath, job); initialWrite.then(() => startedResolve({ status: 'accepted', pid, localOnly: true, device: 'cpu', maxSeconds: 360, steps, batch }), startedReject); } });
      work.then(async result => { await initialWrite; job.status = result.status || 'completed'; job.result = { status: result.status, runId: result.run_id }; job.completedAt = new Date().toISOString(); await atomicJson(jobPath, job); }, async error => { startedReject(error); await initialWrite; job.status = 'failed'; job.error = String(error.message).slice(0, 2000); job.completedAt = new Date().toISOString(); await atomicJson(jobPath, job); }).catch(() => {}).finally(() => { activeJob = null; });
      return await started;
      } finally { trainingStarting = false; }
    }
    if (foregroundBusy) throw new Error('El laboratorio está atendiendo otra petición');
    foregroundBusy = true;
    try {
      if (action === 'decision') {
        if (typeof payload.question !== 'string' || !payload.question.trim() || payload.question.length > 4000) throw new Error('Pregunta entre 1 y 4000 caracteres');
        return await invoke(action, { question: payload.question.trim() }, { signal, timeoutMs: 90_000 });
      }
      if (typeof payload.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 4000) throw new Error('Descripción entre 1 y 4000 caracteres');
      const id = `game-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const result = await invoke(action, { prompt: payload.prompt.trim(), id }, { signal, timeoutMs: 30_000 });
      return { ...result, id, artifactUrl: `/project/artifacts/${id}/index.html` };
    } finally { foregroundBusy = false; }
  }
  async function resolveSecondaryArtifact(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.includes('\\') || relativePath.includes('%')) return null;
    const parts = relativePath.split('/');
    if (parts[0] === 'games') parts.shift();
    if (parts.length !== 2 || !/^game-\d{10,16}-[a-f0-9]{8}$/.test(parts[0]) || !Object.hasOwn(ARTIFACTS, parts[1])) return null;
    const base = path.resolve(data, 'games'), target = path.resolve(base, parts[0], 'prototype', parts[1]);
    try {
      const [realBase, realTarget, stat] = await Promise.all([fs.realpath(base), fs.realpath(target), fs.stat(target)]);
      const relative = path.relative(realBase, realTarget);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !stat.isFile() || stat.size > 2_000_000) return null;
      return { path: realTarget, bytes: await fs.readFile(realTarget), mime: ARTIFACTS[parts[1]] };
    } catch { return null; }
  }
  async function searchSecondaryMemory(query, { limit = 2 } = {}) {
    if (typeof query !== 'string' || !query.trim() || query.length > 4000) return [];
    const tokens = [...new Set(query.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || [])].slice(0, 24);
    const stop = new Set('a al algo como con cual cuando de del el ella en es esta este hay la las lo los me mi para por que qué se si sin sobre su un una y'.split(' '));
    const words = tokens.filter(token => !stop.has(token));
    if (!words.length) return [];
    const maximum = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 4)) : 2;
    const file = path.join(componentRoot, 'memory', 'portable-atlas-memory.sqlite3');
    if (!await exists(file)) return [];
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const rows = db.prepare(`SELECT c.text,c.start_line,c.end_line,d.title,d.source,d.sha256,bm25(chunk_search) AS rank
        FROM chunk_search JOIN chunks c ON c.id=chunk_search.rowid JOIN documents d ON d.id=c.document_id
        WHERE chunk_search MATCH ? AND d.active=1 ORDER BY rank,c.id LIMIT ?`).all(words.map(word => `"${word.replaceAll('"', '""')}"`).join(' OR '), maximum);
      let remaining = 3000;
      return rows.flatMap(row => {
        if (!remaining) return [];
        const text = row.text.slice(0, Math.min(1500, remaining)); remaining -= text.length;
        let url;
        try { const candidate = new URL(row.source); if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) url = candidate.href; } catch {}
        return [{ title: String(row.title).slice(0, 180), text, ...(url ? { url } : {}), source: String(row.source).slice(0, 500), provenance: 'imported-atlas597-memory', evidence: 'unverified', verified: false, sha256: row.sha256, lines: [row.start_line, row.end_line] }];
      });
    } finally { db.close(); }
  }
  return { secondaryStatus, runSecondary, resolveSecondaryArtifact, searchSecondaryMemory };
}

const singleton = createSecondaryAtlas();
export const secondaryStatus = singleton.secondaryStatus;
export const runSecondary = singleton.runSecondary;
export const resolveSecondaryArtifact = singleton.resolveSecondaryArtifact;
export const searchSecondaryMemory = singleton.searchSecondaryMemory;
