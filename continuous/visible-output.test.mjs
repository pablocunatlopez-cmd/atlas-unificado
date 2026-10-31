import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeModelAnswer, createVisibleAnswerStream} from './visible-output.mjs';

test('strips only leading thought envelopes and hides unfinished thoughts', () => {
  assert.equal(sanitizeModelAnswer('<think>private reasoning</think>\n\nÓrbita'), 'Órbita');
  assert.equal(sanitizeModelAnswer(' \n<THINK>first</THINK>\n<think>second</think>\nRespuesta'), 'Respuesta');
  assert.equal(sanitizeModelAnswer('<think>unfinished reasoning'), '');
  assert.equal(sanitizeModelAnswer('   Respuesta normal.\n'), '   Respuesta normal.\n');
});

test('an orphan close selects the final nonempty answer segment', () => {
  assert.equal(sanitizeModelAnswer('Órbita\n</think>\n\nÓrbita'), 'Órbita');
  assert.equal(sanitizeModelAnswer('first\n</think>\nsecond\n</think>\nFinal'), 'Final');
  assert.equal(sanitizeModelAnswer('first\n</think>\nFinal\n</think>\n'), 'Final');
  assert.equal(sanitizeModelAnswer('</think>Final'), 'Final');
  assert.equal(sanitizeModelAnswer('Respuesta\n</think>\n'), 'Respuesta');
  assert.equal(sanitizeModelAnswer('</think>'), '');
});

const literalExamples = [
  'Usa `<think>` y `</think>` como ejemplo, sin borrarlos.',
  'La cadena <think>ejemplo</think> se conserva dentro de una explicación.',
  '```javascript\nconst text = `<think>\n</think>\n`;\n```',
  'Aquí tienes el código:\n```js\nconst text = `\n</think>\n`;\n```',
  'const template = `<think>\n</think>\ntexto`;\nfunction transform(input) { return template; }',
  'function transform(input) {\n  return `<think>\n</think>\n`;\n}',
  '{"example":"<think>texto</think>"}',
  '    <think>ejemplo literal</think>',
  '<div>\n</think>\n</div>',
  '> </think> es una etiqueta en esta cita.'
];

test('preserves literal tags in JavaScript, JSON, inline text and Markdown', () => {
  for (const text of literalExamples) assert.equal(sanitizeModelAnswer(text), text);
  const code = literalExamples[4];
  assert.equal(sanitizeModelAnswer('<think>private</think>\n' + code), code);
});

test('fragmented envelopes never emit their reasoning or delimiters', () => {
  const raw = ' \n<think>privado 🌍\nrazonamiento</think>\n\n¡Órbita!';
  for (const size of [1, 2, 3, 7, 20, raw.length]) {
    const deltas = [];
    const stream = createVisibleAnswerStream(delta => deltas.push(delta));
    for (let i = 0; i < raw.length; i += size) stream.push(raw.slice(i, i + size));
    assert.equal(stream.finish(), '¡Órbita!');
    assert.equal(deltas.join(''), '¡Órbita!');
  }
});

test('multiple envelopes and interrupted reasoning have no visible leakage', () => {
  const deltas = [];
  const stream = createVisibleAnswerStream(delta => deltas.push(delta));
  for (const delta of ['<thi', 'nk>secret</thi', 'nk>\n<think>second', '</think>\nOK']) stream.push(delta);
  assert.equal(stream.finish(), 'OK');
  assert.equal(deltas.join(''), 'OK');
  const unfinished = createVisibleAnswerStream(() => assert.fail('reasoning was emitted'));
  unfinished.push('<think>unfinished');
  assert.equal(unfinished.finish(), '');
});

test('orphan markers are hidden while the final answer replaces already-emitted provisional text', () => {
  const deltas = [];
  const stream = createVisibleAnswerStream(delta => deltas.push(delta));
  for (const char of 'Órbita\n</think>\n\nÓrbita') stream.push(char);
  assert.equal(stream.finish(), 'Órbita');
  assert.ok(deltas.join('').includes('Órbita'));
  assert.ok(!deltas.join('').includes('</think>'));
});

test('streaming preserves literal examples byte-for-byte, even across character chunks', () => {
  for (const text of literalExamples) {
    const deltas = [];
    const stream = createVisibleAnswerStream(delta => deltas.push(delta));
    for (const char of text) stream.push(char);
    assert.equal(stream.finish(), text);
    assert.equal(deltas.join(''), text);
  }
});

test('normal deltas are forwarded promptly, finish is stable, and post-finish writes fail', () => {
  const deltas = [];
  const stream = createVisibleAnswerStream(delta => deltas.push(delta));
  stream.push('Hola ');
  assert.deepEqual(deltas, ['Hola ']);
  stream.push('mundo.');
  assert.deepEqual(deltas, ['Hola ', 'mundo.']);
  assert.equal(stream.finish(), 'Hola mundo.');
  assert.equal(stream.finish(), 'Hola mundo.');
  assert.throws(() => stream.push('extra'), /terminado/);
});
