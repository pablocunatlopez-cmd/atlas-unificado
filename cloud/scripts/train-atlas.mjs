import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TinyLanguageModel, encode, parameterCount } from '../public/core/language-model.mjs';
const native = JSON.parse(readFileSync(new URL('../data/native-principles.json', import.meta.url), 'utf8'));
const archive = JSON.parse(readFileSync(new URL('../data/archive.json', import.meta.url), 'utf8'));
const core = JSON.parse(readFileSync(new URL('../data/core.json', import.meta.url), 'utf8'));
const documents = [...native, ...archive, { ...core, text: core.text.slice(0, 50000) }];
const trainParts = [], validationParts = [];
for (const doc of documents) { const text = doc.text.slice(0, 35000); const cut = Math.floor(text.length * .85); trainParts.push(text.slice(0, cut)); validationParts.push(text.slice(cut)); }
const corpus = trainParts.join('\n\n'), validationCorpus = validationParts.join('\n\n');
const train = encode(corpus), validation = encode(validationCorpus), model = new TinyLanguageModel(undefined, 4217);
const before = model.evaluate(validation, 600), started = performance.now();
let best = model.snapshot(), bestLoss = before;
for (let round = 0; round < 16; round++) { const trainLoss = model.train(train, 2000, 4217 + round); const loss = model.evaluate(validation, 600); if (loss < bestLoss) { best = model.snapshot(); bestLoss = loss; } console.log(JSON.stringify({ steps: model.steps, trainLoss: +trainLoss.toFixed(4), validationLoss: +loss.toFixed(4) })); }
const result = { snapshot: best, metrics: { before, after: bestLoss, trainCharacters: train.length, validationCharacters: validation.length, elapsedMs: performance.now() - started, attemptedSteps: model.steps, improved: bestLoss < before }, provenance: { algorithm: 'Character embedding + tanh MLP + softmax, SGD from random weights', seed: 4217, parameters: parameterCount, corpusSha256: createHash('sha256').update(corpus).digest('hex'), validationSha256: createHash('sha256').update(validationCorpus).digest('hex'), documents: documents.map(d => d.id), trainedAt: new Date().toISOString(), limitation: 'Reserva local usada para selección; no es una evaluación externa de capacidades.' } };
writeFileSync(new URL('../data/atlas-lm-seed.json', import.meta.url), JSON.stringify(result));
console.log(JSON.stringify({ saved: 'data/atlas-lm-seed.json', parameters: parameterCount, steps: best.steps, before, after: bestLoss, elapsedMs: result.metrics.elapsedMs }));
