import type { AtlasReply, AtlasState, Domain, MemoryScope } from './atlas-types';

export type Knowledge = { id: string; title: string; text: string; kind: string; date?: string; url?: string };
export type SearchHit = Knowledge & { score: number; coverage: number };
export const CORE_VERSION = 'Atlas Core 0.3';
export type RetrievalProfile='baseline'|'focused';
const stops = new Set('a al algo ante bajo con contra cual cuando de del desde donde durante el ella en entre era es esa ese eso esta este esto fue ha hacia hasta hay la las lo los me mi mis muy no nos o para pero por porque que quien se si sin sobre su sus te tiene todo tu un una uno unos y ya yo atlas dime quiero puedes favor'.split(' '));
export const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function tokens(s: string) { return (normalize(s).match(/[a-z0-9]{2,}/g) || []).filter(t => !stops.has(t)); }
export function chunkKnowledge(docs: Knowledge[]): Knowledge[] {
  return docs.flatMap(d => {
    const parts = d.text.split(/\n\s*\n/).flatMap(p => { const out: string[] = []; for (let i = 0; i < p.length; i += 1000) out.push(p.slice(i, i + 1200)); return out; });
    return parts.filter(p => p.trim().length > 20).map((text, i) => ({ ...d, id: `${d.id}:${i}`, text }));
  });
}
export function retrieve(query: string, docs: Knowledge[], limit = 4, profile:RetrievalProfile='baseline'): SearchHit[] {
  const q = [...new Set(tokens(query))]; if (!q.length || !docs.length) return [];
  const tokenized = docs.map(d => tokens(d.title + ' ' + d.text));
  const avg = tokenized.reduce((a, b) => a + b.length, 0) / docs.length || 1;
  const frequencies = new Map(q.map(t => [t, tokenized.filter(ts => ts.includes(t)).length]));
  return docs.map((doc, i) => {
    const ts = tokenized[i], title = tokens(doc.title); let score = 0, matches = 0;
    for (const term of q) {
      const f = ts.filter(t => t === term).length; if (!f) continue; matches++;
      const idf = Math.log(1 + (docs.length - (frequencies.get(term) || 0) + .5) / ((frequencies.get(term) || 0) + .5));
      score += idf * (f * 2.2) / (f + 1.2 * (.25 + .75 * ts.length / avg)) + (title.includes(term) ? .7 : 0);
    }
    const coverage = matches / q.length;
    const phrase=normalize(query).trim().replace(/\s+/g,' ');
    const titlePhrase=profile==='focused'&&phrase.length>4&&normalize(doc.title).includes(phrase)?5:0;
    return { ...doc, score: score * coverage+titlePhrase, coverage };
  }).filter(d => d.score > 0 && d.coverage >= Math.min(.4, 1 / q.length)).sort((a, b) => b.score - a.score).slice(0, limit);
}
// Scoped notes are not silently reused by the general chat: the default scope
// is global, and a resident/room/module note must be requested explicitly.
export function memoryKnowledge(state: AtlasState, scope: MemoryScope = 'global'): Knowledge[] {
  const invalid = state.corrections.map(c => normalize(c.before.trim()));
  return [
    ...state.corrections.map(c => ({ id: 'correction:' + c.id, title: 'Corrección vigente', text: c.after + '\nMotivo: ' + c.reason, kind: 'Corrección aportada', date: c.date })),
    ...state.memories.filter(m => m.status !== 'Retirado' && (m.scope ?? 'global') === scope && !invalid.some(x => x && normalize(m.text).includes(x))).map(m => ({ id: 'memory:' + m.id, title: m.title, text: m.text, kind: 'Memoria · ' + m.status, date: m.date })),
    ...state.decisions.map(d => ({ id: 'decision:' + d.id, title: d.title, text: [d.known, d.action, d.outcome].filter(Boolean).join('\n'), kind: 'Decisión · ' + d.status, date: d.date }))
  ];
}

/** Recursive-descent arithmetic, never eval, Function or dynamic code. */
export function calculate(input: string): { expression: string; value: number } | null {
  let expression = normalize(input.trim()).replace(/^(?:calcula(?:r)?|cuanto es|cuanto da|resuelve)\s*:?\s*/, '').replace(/[?¿=]$/g, '').trim();
  expression = expression.replace(/(\d+(?:[.,]\d+)?)\s*%\s*de\s*(\d+(?:[.,]\d+)?)/g, '($1/100*$2)').replace(/,/g, '.').replace(/[×x]/g, '*').replace(/÷/g, '/');
  if (!/^[\d\s.+*/()^%-]+$/.test(expression) || !/\d/.test(expression)) return null;
  if (expression.length > 256) throw new Error('Cálculo demasiado largo.');
  const ts = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+*/^%-]/g) || []; let n = 0, depth = 0;
  function primary(): number { if (++depth > 32) throw new Error('Demasiados paréntesis.'); let r: number; if (ts[n] === '(') { n++; r = sum(); if (ts[n++] !== ')') throw new Error('Falta un paréntesis.'); } else { const t = ts[n++]; if (!t || !/^(?:\d|\.)/.test(t)) throw new Error('Expresión incompleta.'); r = Number(t); } depth--; return r; }
  function power(): number { let r = primary(); if (ts[n] === '^') { n++; const e = unary(); if (Math.abs(e) > 1000) throw new Error('Exponente fuera de límite.'); r = r ** e; } return r; }
  function unary(): number { if (ts[n] === '-') { n++; return -unary(); } if (ts[n] === '+') { n++; return unary(); } return power(); }
  function product(): number { let r = unary(); while (['*', '/', '%'].includes(ts[n])) { const op = ts[n++], v = unary(); if ((op === '/' || op === '%') && v === 0) throw new Error('No se puede dividir entre cero.'); r = op === '*' ? r * v : op === '/' ? r / v : r % v; } return r; }
  function sum(): number { let r = product(); while (['+', '-'].includes(ts[n])) { const op = ts[n++], v = product(); r = op === '+' ? r + v : r - v; } return r; }
  const value = sum(); if (n !== ts.length || !Number.isFinite(value) || Math.abs(value) > 1e100) throw new Error('Expresión no válida o resultado fuera de límite.');
  return { expression, value };
}

type Fact = { subject: string; predicate: string; negative: boolean };
function fact(s: string): Fact | null { const m = normalize(s.trim().replace(/[.;]$/, '')).match(/^([a-z0-9 _-]+?) (no es|es) ([a-z0-9 _-]+)$/); return m ? { subject: m[1].trim(), predicate: m[3].trim(), negative: m[2] === 'no es' } : null; }
const key = (f: Fact) => f.subject + (f.negative ? ' no es ' : ' es ') + f.predicate;
export function deduce(input: string) {
  if (!/(?:hecho|regla|consulta):/i.test(input)) return null;
  const lines = input.split(/\n|;/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 60) throw new Error('Máximo 60 hechos y reglas por consulta.');
  const facts = new Map<string, Fact>(), rules: { before: Fact; after: Fact; text: string }[] = [], proofs: { result: string; premise: string; rule: string }[] = [];
  let query: Fact | null = null;
  for (const line of lines) {
    const f = line.match(/^hecho:\s*(.+)$/i), r = line.match(/^regla:\s*si (.+) entonces (.+)$/i), q = line.match(/^consulta:\s*(.+)$/i);
    if (f) { const v = fact(f[1]); if (!v) throw new Error('Formato: hecho: luna es mamífero'); facts.set(key(v), v); }
    else if (r) { const before = fact(r[1]), after = fact(r[2]); if (!before || !after) throw new Error('Formato: regla: si algo es mamífero entonces algo es animal'); rules.push({ before, after, text: line.slice(7) }); }
    else if (q) { query = fact(q[1]); if (!query) throw new Error('Formato: consulta: luna es animal'); }
    else throw new Error('Usa líneas con hecho:, regla: o consulta:.');
  }
  for (let round = 0; round < 32; round++) {
    let added = false;
    for (const rule of rules) for (const f of [...facts.values()]) {
      const variable = ['algo', 'x', 'alguien'].includes(rule.before.subject);
      if (rule.before.predicate !== f.predicate || rule.before.negative !== f.negative || (!variable && rule.before.subject !== f.subject)) continue;
      const next = { ...rule.after, subject: variable && rule.after.subject === rule.before.subject ? f.subject : rule.after.subject };
      if (!facts.has(key(next))) { facts.set(key(next), next); proofs.push({ result: key(next), premise: key(f), rule: rule.text }); added = true; }
      if (facts.size > 250) throw new Error('El conjunto de reglas supera el límite de 250 hechos.');
    }
    if (!added) break;
  }
  const contradictions = [...facts.values()].filter(f => !f.negative && facts.has(key({ ...f, negative: true }))).map(key);
  const positive = query ? facts.has(key(query)) : false, negative = query ? facts.has(key({ ...query, negative: !query.negative })) : false;
  return { query: query ? key(query) : null, result: positive && negative ? 'contradicción' : positive ? 'demostrado bajo las premisas' : negative ? 'negación demostrada bajo las premisas' : 'desconocido', facts: [...facts.keys()], proofs, contradictions };
}

export function makeReply(text: string, state: AtlasState, knowledge: Knowledge[], domain: Domain = 'general', profile:RetrievalProfile='baseline'): AtlasReply {
  const reply: AtlasReply = { answer: '', basis: 'Núcleo propio: recuperación léxica, cálculo y reglas explícitas. Sin llamada a modelos externos.', confidence: 'Limitada', claims: [], unknowns: [], nextSteps: [], wouldChange: 'Una fuente nueva o una corrección tuya puede cambiar el resultado.', frame: { object: text.slice(0,150), environment: 'Tu memoria y los documentos disponibles', perspective: 'Atlas Core, alcance local', scale: 'Esta consulta' }, semiosis: { object: 'La pregunta recibida', sign: 'Texto y registros recuperados', interpretant: 'Resultado acotado por el método usado' }, triangle: { center: 'Datos y operaciones declaradas en la respuesta.', animal: 'Tus necesidades no se deducen automáticamente del texto.', mind: 'Recuperación, aritmética y reglas.', event: 'Información que falta y errores posibles.' }, sources: [], engine: 'native', searched: false };
  try {
    const c = calculate(text);
    if (c) return { ...reply, answer: `${c.expression} = ${Number(c.value.toPrecision(12)).toLocaleString('es-ES', { maximumFractionDigits: 12 })}`, confidence: 'Alta', basis: 'Calculado con el analizador aritmético propio; números de coma flotante, no aritmética exacta.', claims: [{ label: 'Cálculo ejecutado', text: String(c.value), why: 'Operaciones analizadas sin ejecutar código del usuario.' }], unknowns: ['El cálculo no verifica que los números representen tu situación real.'] };
    const logic = deduce(text);
    if (logic) return { ...reply, answer: `${logic.query ? logic.query + ': ' : ''}${logic.result}.\n\n${logic.proofs.length ? logic.proofs.map(p => p.result + ' ← ' + p.premise + '; ' + p.rule).join('\n') : 'No se añadieron inferencias nuevas.'}${logic.contradictions.length ? '\n\nPremisas contradictorias: ' + logic.contradictions.join(', ') : ''}`, basis: 'Encadenamiento hacia delante sobre hechos y reglas que has escrito. Las premisas no han sido verificadas.', confidence: 'Razonable', unknowns: ['Validez externa de las premisas. Ausencia de una prueba no significa falsedad.'], claims: logic.proofs.slice(0,5).map(p => ({ label: 'Inferencia formal', text: p.result, why: p.premise + '; ' + p.rule })) };
  } catch (e) { return { ...reply, answer: 'No he podido resolverlo: ' + (e instanceof Error ? e.message : 'Entrada no válida.'), unknowns: ['Revisa la expresión o las premisas.'] }; }
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches)[!. ]*$/.test(normalize(text))) return { ...reply, answer: `Hola, ${state.settings.name}. Mi núcleo es propio. Sigo la Espiral Atlas: observar, comprender, conectar, aplicar, refutar y aprender. Puedo recuperar tu memoria, consultar documentos, buscar fuentes públicas, calcular y resolver reglas explícitas. Para probarlo, escribe «calcula (1500 - 600) * 12» o pregúntame por algo que hayas guardado.`, nextSteps: ['En Espiral Atlas puedes revisar mis ciclos; Núcleo propio reúne documentos y entrenamiento.'] };
  if (/modelo|capacidades|quien eres|puedes hacer|grok|claude|6\.1|sol\b/.test(normalize(text)) && !/papel|documento|investigacion/.test(normalize(text))) return { ...reply, answer: 'Soy Atlas Core: un motor propio con memoria, búsqueda documental y web, aritmética y lógica de reglas. Mi agenda de investigación conserva fuentes nuevas y puede promover una mejora acotada de recuperación cuando supera su evaluación fija. Atlas LM-0.1 es mi modelo de lenguaje pequeño: pesos inicializados al azar, entrenados con texto de Atlas, sin pesos ni servicios de OpenAI, Anthropic o xAI.\n\nEl chat compone resultados de mis herramientas; el modelo neuronal se prueba por separado en Núcleo propio. Todavía no tengo la comprensión general ni la calidad de Claude, Grok o Sol. Studio permite crear bases de aplicaciones HTML/CSS/JavaScript, renders procedurales, escenas 3D y juegos de conducción o exploración. No es generación general de software ni producción AAA. Puedes medir mi pérdida de validación, entrenarme con tus textos y examinar las pruebas. No hay una comparativa externa que demuestre equivalencia.', unknowns: ['Capacidad de generalizar a tareas que no están en mis pruebas.', 'El entrenamiento de caracteres no demuestra razonamiento general.'], nextSteps: ['Prueba una pregunta sobre tu memoria o abre Núcleo propio.'] };
  const hits = retrieve(text, [...memoryKnowledge(state), ...knowledge],4,profile);
  if (!hits.length) return { ...reply, answer: 'No encuentro información suficiente en mi memoria ni en el corpus para responder a esa pregunta. Mi núcleo todavía no comprende ni redacta como un modelo de lenguaje grande.\n\nPuedes añadir un documento sobre el tema en Núcleo propio, guardar un dato en Memoria o formular un cálculo. La pregunta queda disponible en tu conversación; no la convierto automáticamente en un hecho.', unknowns: ['No hay un fragmento pertinente recuperado.', 'No he consultado fuentes actuales de internet.'], nextSteps: ['Añade una fuente con su fecha y vuelve a preguntar.'] };
  const corrections = hits.filter(h => h.kind.startsWith('Corrección'));
  const selected = (corrections.length ? corrections : hits).slice(0,3);
  reply.answer = 'He recuperado estos fragmentos relacionados con tu pregunta:\n\n' + selected.map((h,i) => `[${i+1}] ${h.title}\n${h.text.slice(0,1100)}`).join('\n\n') + '\n\nSon fragmentos del corpus, no una respuesta verificada de forma independiente. Si no resuelven tu pregunta, necesito una fuente más precisa.';
  reply.claims = selected.map(h => ({ label: h.kind.includes('histórico') ? 'Registro histórico' : /Documento web|Fuente secundaria|Resumen editorial|Repositorio público|Prepublicación/.test(h.kind)?'Contenido externo por contrastar':'Dato aportado', text: h.text.slice(0,700), why: h.kind + (h.date ? ' · ' + h.date : '') }));
  reply.sources = selected.map(h => ({ title: h.title, url: h.url || '#memory', kind: h.kind }));
  reply.unknowns = ['La coincidencia de palabras no garantiza que un fragmento responda a la pregunta.', 'La vigencia y veracidad externa del contenido no se verifican automáticamente.'];
  if (domain === 'salud' || domain === 'dinero') reply.unknowns.push('Estos documentos no permiten emitir un diagnóstico ni recomendar una operación financiera.');
  reply.nextSteps = ['Contrasta el fragmento y registra cualquier corrección en Memoria.'];
  return reply;
}

export function capabilityTests() {
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const test = (name: string, fn: () => boolean, detail: string) => { try { checks.push({ name, passed: fn(), detail }); } catch { checks.push({ name, passed: false, detail }); } };
  test('Aritmética con precedencia', () => calculate('(7 + 5) * 3 - 4')?.value === 32, 'Resultado esperado: 32.');
  test('No evalúa código', () => calculate('globalThis.secret') === null, 'Solo gramática numérica.');
  test('División por cero', () => { try { calculate('12/0'); return false; } catch { return true; } }, 'Debe rechazar el resultado.');
  test('Inferencia de dos pasos', () => deduce('hecho: nora es ave\nregla: si algo es ave entonces algo es animal\nregla: si algo es animal entonces algo es ser vivo\nconsulta: nora es ser vivo')?.result === 'demostrado bajo las premisas', 'Encadenamiento sobre premisas sintéticas.');
  test('Contradicciones visibles', () => deduce('hecho: sol es estrella\nhecho: sol no es estrella\nconsulta: sol es estrella')?.result === 'contradicción', 'No elige una de las dos premisas.');
  test('Desconocido no es falso', () => deduce('hecho: nora es ave\nconsulta: nora es verde')?.result === 'desconocido', 'Mundo abierto.');
  test('Recuperación de datos', () => retrieve('azafrán', [{ id: 'a', title: 'Especias', text: 'El azafrán figura en este texto.', kind: 'Fixture' }, { id: 'b', title: 'Música', text: 'La guitarra tiene cuerdas.', kind: 'Fixture' }])[0]?.id === 'a', 'Consulta reservada al evaluador.');
  return checks;
}
