import { TinyLanguageModel, encode } from './core/language-model.mjs';
self.onmessage = event => {
  try {
    const { snapshot, corpus, steps = 2500 } = event.data;
    if (typeof corpus !== 'string' || corpus.length < 500 || corpus.length > 300000) throw new Error('Usa entre 500 y 300.000 caracteres de entrenamiento.');
    const split = Math.floor(corpus.length * .85);
    // No context window crosses the train/validation boundary.
    const train = encode(corpus.slice(0, split)), validation = encode(corpus.slice(split));
    const model = new TinyLanguageModel(snapshot), before = model.evaluate(validation);
    const started = performance.now(), rounds = Math.min(20, Math.max(1, Math.ceil(steps / 250)));
    let best = snapshot, bestLoss = before, trainLoss = before;
    for (let round = 0; round < rounds; round++) {
      trainLoss = model.train(train, 250, 109 + round);
      const validationLoss = model.evaluate(validation);
      if (validationLoss < bestLoss) { best = model.snapshot(); bestLoss = validationLoss; }
      self.postMessage({ type: 'progress', completed: (round + 1) * 250, total: rounds * 250, trainLoss, validationLoss, elapsedMs: performance.now() - started });
    }
    const chosen = best || model.snapshot();
    self.postMessage({ type: 'done', snapshot: chosen, metrics: { before, after: bestLoss, trainLoss, attemptedSteps: rounds * 250, elapsedMs: performance.now() - started, trainCharacters: train.length, validationCharacters: validation.length, improved: bestLoss < before - 0.001 } });
  } catch (error) { self.postMessage({ type: 'error', message: error.message || 'No se completó el entrenamiento.' }); }
};
