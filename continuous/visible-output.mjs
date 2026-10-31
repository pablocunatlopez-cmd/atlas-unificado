const OPEN = '<think>';
const CLOSE = '</think>';

// A closing tag inside a quoted example or source file is data. Stop treating
// subsequent lines as an orphan reasoning envelope once source/Markdown begins.
function literalLine(line) {
  return /^[ \t]{4}\S/.test(line) || /^[ \t]*(?:`{3,}|~{3,}|["'`]|\/\/|\/\*|[\[{])/.test(line) ||
    /^[ \t]*(?:(?:export\s+)?(?:async\s+)?function\b|(?:export\s+)?(?:const|let|var|class|import)\b|return\s|def\s|from\s)/.test(line) ||
    /^[ \t]*<(?!\/?think>)[a-z!/][^>]*>/i.test(line);
}

function startsLiteral(text) {
  const first = text.split(/\r?\n/).find(line => line.trim());
  return first !== undefined && literalLine(first);
}

/**
 * Parse a model's leading reasoning envelope, not arbitrary tags in its answer.
 * Orphan closes must occupy their own line (or be the very first token). This
 * recovers engines whose chat template has already emitted the opening tag.
 * A quoted/fenced/source example is preserved. A literal opening <think> at
 * the very beginning is inherently ambiguous; quote or fence such examples.
 */
export function sanitizeModelAnswer(value) {
  if (typeof value !== 'string') throw new TypeError('La respuesta del modelo debe ser texto.');
  let text = value;
  if (startsLiteral(text)) return text;
  while (/^\s*<think>/i.test(text)) {
    const open = /^\s*<think>/i.exec(text)[0].length;
    const close = text.toLowerCase().indexOf(CLOSE, open);
    if (close < 0) return ''; // An unfinished thought is not a final answer.
    text = text.slice(close + CLOSE.length).trimStart();
    if (startsLiteral(text)) return text;
  }

  const markers = [];
  const leadingClose = /^\s*<\/think>/i.exec(text);
  if (leadingClose) markers.push({start: 0, end: leadingClose[0].length});
  let offset = 0;
  for (const line of text.split('\n')) {
    if (literalLine(line)) break;
    if (/^[ \t]*<\/think>[ \t]*\r?$/i.test(line)) {
      const start = offset, end = offset + line.length;
      if (!markers.some(marker => marker.start === start)) markers.push({start, end});
    }
    offset += line.length + 1;
  }
  // Prefer the final nonempty answer segment. A trailing orphan delimiter alone
  // does not erase a preceding answer, but the delimiter itself is removed.
  for (let i = markers.length - 1; i >= 0; i--) {
    const marker = markers[i];
    const suffix = text.slice(marker.end).trim();
    if (suffix) return suffix;
    text = text.slice(0, marker.start);
  }
  return markers.length ? text.trimEnd() : text;
}

/**
 * Incrementally hides leading <think> blocks, including split delimiters.
 * Orphan preambles may already have been emitted: finish() returns the corrected
 * final answer, which the caller must use in its terminal event/persistence.
 */
export function createVisibleAnswerStream(onDelta) {
  if (onDelta !== undefined && typeof onDelta !== 'function') throw new TypeError('onDelta debe ser una función.');
  let raw = '', pending = '', state = 'prefix', trimPadding = false;
  let currentLine = '', held = '', holdLinePrefix = true, protectedOutput = false, hasEmitted = false;
  let finished = false;

  function emitVisible(value, final = false) {
    let output = '';
    for (const char of value) {
      if (protectedOutput) { output += char; continue; }
      if (char === '\n') {
        const delimiter = /^[ \t]*<\/think>[ \t]*\r?$/i.test(held);
        if (!delimiter) output += held + '\n';
        protectedOutput = literalLine(currentLine);
        currentLine = ''; held = ''; holdLinePrefix = true;
        continue;
      }
      currentLine += char;
      if (!holdLinePrefix) { output += char; continue; }
      held += char;
      const token = held.trimStart().toLowerCase();
      if (!token || CLOSE.startsWith(token) || (token.startsWith(CLOSE) && /^[ \t\r]*$/.test(token.slice(CLOSE.length)))) {
        // An orphan close at the beginning is framing even without a newline.
        if (!hasEmitted && !output && token === CLOSE) { held = ''; currentLine = ''; }
        continue;
      }
      output += held; held = ''; holdLinePrefix = false;
    }
    if (final && held) {
      if (!/^[ \t]*<\/think>[ \t]*\r?$/i.test(held)) output += held;
      held = '';
    }
    if (output) { hasEmitted = true; onDelta?.(output); }
  }

  function process() {
    while (state !== 'visible') {
      if (state === 'thinking') {
        const close = pending.toLowerCase().indexOf(CLOSE);
        if (close < 0) { pending = pending.slice(-(CLOSE.length - 1)); return; }
        pending = pending.slice(close + CLOSE.length);
        state = 'prefix'; trimPadding = true;
        continue;
      }
      if (trimPadding) pending = pending.trimStart();
      const token = pending.trimStart().toLowerCase();
      if (!token) return;
      if (!startsLiteral(pending)) {
        if (token.startsWith(OPEN)) {
          pending = pending.trimStart().slice(OPEN.length); state = 'thinking'; continue;
        }
        if (OPEN.startsWith(token)) return;
      }
      state = 'visible';
    }
    emitVisible(pending); pending = '';
  }

  return {
    push(delta) {
      if (finished) throw new Error('El flujo visible ya ha terminado.');
      if (typeof delta !== 'string') throw new TypeError('El fragmento del modelo debe ser texto.');
      raw += delta; pending += delta; process();
    },
    finish() {
      if (!finished) {
        if (state !== 'thinking') emitVisible(pending, true);
        finished = true;
      }
      return sanitizeModelAnswer(raw);
    }
  };
}
