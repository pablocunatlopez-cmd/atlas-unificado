/** Atlas LM-0.1. A character MLP, random initialization and SGD. No imported weights. */
export const MODEL_FORMAT = 'atlas-character-mlp-v1';
export const alphabet = '\n abcdefghijklmnopqrstuvwxyzáéíóúüñ0123456789.,;:¿?¡!()-/%+="\'';
export const config = { context: 8, embedding: 8, hidden: 40, vocabulary: alphabet.length };
const { context: C, embedding: E, hidden: H, vocabulary: V } = config;
const sizes = { embedding: V * E, hidden: C * E * H, hiddenBias: H, output: H * V, outputBias: V };
export const parameterCount = Object.values(sizes).reduce((a, b) => a + b, 0);
export function random(seed = 42) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function encode(text) {
  return Array.from(text.toLowerCase().normalize('NFC')).map(c => alphabet.indexOf(c)).filter(i => i >= 0);
}
export function validateSnapshot(s) {
  return !!s && s.format === MODEL_FORMAT && s.parameters === parameterCount && Object.entries(config).every(([k, v]) => s.config?.[k] === v) && s.steps >= 0 && Number.isSafeInteger(s.steps) &&
    Object.entries(sizes).every(([k, n]) => Array.isArray(s.weights?.[k]) && s.weights[k].length === n && s.weights[k].every(x => Number.isFinite(x) && Math.abs(x) < 100));
}
export class TinyLanguageModel {
  constructor(snapshot, seed = 42) {
    const rng = random(seed);
    this.steps = 0;
    this.weights = {};
    for (const [key, n] of Object.entries(sizes)) {
      this.weights[key] = new Float64Array(n);
      if (!key.endsWith('Bias')) for (let i = 0; i < n; i++) this.weights[key][i] = (rng() * 2 - 1) * (key === 'embedding' ? 0.2 : 0.12);
    }
    if (snapshot) {
      if (!validateSnapshot(snapshot)) throw new Error('Checkpoint incompatible o no finito.');
      for (const key of Object.keys(sizes)) this.weights[key].set(snapshot.weights[key]);
      this.steps = snapshot.steps;
    }
    this.x = new Float64Array(C * E); this.h = new Float64Array(H); this.p = new Float64Array(V);
    this.dh = new Float64Array(H); this.dx = new Float64Array(C * E);
  }
  forward(ctx) {
    const w = this.weights, x = this.x, h = this.h, p = this.p;
    for (let c = 0; c < C; c++) for (let e = 0; e < E; e++) x[c * E + e] = w.embedding[(ctx[c] ?? 1) * E + e];
    for (let j = 0; j < H; j++) { let sum = w.hiddenBias[j]; for (let k = 0; k < C * E; k++) sum += x[k] * w.hidden[k * H + j]; h[j] = Math.tanh(sum); }
    let max = -Infinity;
    for (let v = 0; v < V; v++) { let sum = w.outputBias[v]; for (let j = 0; j < H; j++) sum += h[j] * w.output[j * V + v]; p[v] = sum; if (sum > max) max = sum; }
    let total = 0;
    for (let v = 0; v < V; v++) { p[v] = Math.exp(p[v] - max); total += p[v]; }
    for (let v = 0; v < V; v++) p[v] /= total;
    return p;
  }
  trainOne(ctx, target, rate = 0.025) {
    const p = this.forward(ctx), loss = -Math.log(Math.max(1e-12, p[target]));
    const w = this.weights, h = this.h, dh = this.dh, dx = this.dx;
    dh.fill(0); dx.fill(0);
    for (let v = 0; v < V; v++) {
      const g = p[v] - (v === target ? 1 : 0);
      for (let j = 0; j < H; j++) { dh[j] += w.output[j * V + v] * g; w.output[j * V + v] -= rate * h[j] * g; }
      w.outputBias[v] -= rate * g;
    }
    for (let j = 0; j < H; j++) {
      const g = Math.max(-5, Math.min(5, dh[j] * (1 - h[j] * h[j])));
      for (let k = 0; k < C * E; k++) { dx[k] += w.hidden[k * H + j] * g; w.hidden[k * H + j] -= rate * this.x[k] * g; }
      w.hiddenBias[j] -= rate * g;
    }
    // Accumulate repeated character gradients before updating shared embeddings.
    const de = new Map();
    for (let c = 0; c < C; c++) for (let e = 0; e < E; e++) { const i = (ctx[c] ?? 1) * E + e; de.set(i, (de.get(i) || 0) + dx[c * E + e]); }
    for (const [i, g] of de) w.embedding[i] -= rate * Math.max(-5, Math.min(5, g));
    this.steps++; return loss;
  }
  train(tokens, steps = 1000, seed = 42) {
    if (tokens.length <= C + 1) throw new Error('El corpus necesita más texto.');
    const rng = random(seed + this.steps); let loss = 0;
    for (let i = 0; i < steps; i++) { const n = C + Math.floor(rng() * (tokens.length - C)); loss += this.trainOne(tokens.slice(n - C, n), tokens[n]); }
    return loss / steps;
  }
  evaluate(tokens, samples = 300, seed = 1729) {
    if (tokens.length <= C) throw new Error('Reserva de validación insuficiente.');
    const rng = random(seed); let loss = 0;
    for (let i = 0; i < samples; i++) { const n = C + Math.floor(rng() * (tokens.length - C)); loss -= Math.log(Math.max(1e-12, this.forward(tokens.slice(n - C, n))[tokens[n]])); }
    return loss / samples;
  }
  generate(prompt = 'atlas ', length = 240, temperature = 0.65, seed = 42) {
    const rng = random(seed), tokens = encode(prompt), result = [];
    while (tokens.length < C) tokens.unshift(1);
    for (let i = 0; i < Math.min(500, length); i++) {
      const p = this.forward(tokens.slice(-C)); let total = 0;
      const probs = Array.from(p, x => { const y = Math.pow(x, 1 / Math.max(0.2, temperature)); total += y; return y; });
      let r = rng() * total, next = V - 1;
      for (let v = 0; v < V; v++) { r -= probs[v]; if (r <= 0) { next = v; break; } }
      tokens.push(next); result.push(alphabet[next]);
    }
    return prompt + result.join('');
  }
  snapshot() {
    return { format: MODEL_FORMAT, steps: this.steps, config, parameters: parameterCount, weights: Object.fromEntries(Object.entries(this.weights).map(([k, v]) => [k, Array.from(v, x => Math.round(x * 1e7) / 1e7)])) };
  }
}
