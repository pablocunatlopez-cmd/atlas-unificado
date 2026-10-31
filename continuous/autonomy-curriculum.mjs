const MAX_ATTEMPTS = 3;
const FAILURE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// These examples are written independently of generated code. Passing them is
// evidence for a bounded JSON tool, never evidence of general intelligence.
const TASKS = [
  {
    id: 'merge-intervals',
    name: 'Fusionar intervalos',
    task: 'Implementa function transform(input) como función pura de JSON. Entrada: {intervals:[[inicio,fin],...]}, donde cada par contiene exactamente dos números finitos. Normaliza cada par con el menor extremo primero, ordena por inicio ascendente y fusiona intervalos solapados o que se toquen (incluidos puntos e intervalos contenidos). Salida exacta: {intervals:[[inicio,fin],...]}, ordenada y sin solapamientos ni contactos. La lista vacía devuelve {intervals:[]}. Si input no es un objeto con intervals válido, devuelve exactamente {error:"invalid_intervals"}; no conviertas cadenas a números. No imports, red, archivos, procesos, cambios del servidor ni entrenamiento de pesos. Formula la solución, intenta refutarla con casos límite y corrige antes de devolver el código y tus ejemplos.',
    learningPlan: {
      hypothesis: 'Una ordenación por inicio y un barrido con extremo máximo resuelven uniones de intervalos cerrados.',
      refutations: ['Intervalos desordenados y extremos invertidos.', 'Contacto exacto, puntos y un intervalo contenido en otro.', 'Entradas mal formadas que una conversión implícita aceptaría.'],
      evidence: 'Comparar la salida exacta con ocho casos externos al generador y conservar cualquier fallo para reparar.',
      scope: 'Herramienta de transformación JSON; no modifica el servidor ni los pesos del modelo.'
    },
    acceptanceTests: [
      {input: {intervals: []}, expected: {intervals: []}},
      {input: {intervals: [[5, 8], [1, 3], [2, 6], [12, 14]]}, expected: {intervals: [[1, 8], [12, 14]]}},
      {input: {intervals: [[1, 2], [2, 3], [3, 3], [8, 8]]}, expected: {intervals: [[1, 3], [8, 8]]}},
      {input: {intervals: [[1, 10], [2, 3], [4, 9], [1, 10]]}, expected: {intervals: [[1, 10]]}},
      {input: {intervals: [[4, 1], [-1, -3], [0, -1], [4, 5]]}, expected: {intervals: [[-3, 0], [1, 5]]}},
      {input: {intervals: [[1.5, 2.5], [-0.5, 0.5], [0.5, 1.5]]}, expected: {intervals: [[-0.5, 2.5]]}},
      {input: {intervals: [[1, '2']]} , expected: {error: 'invalid_intervals'}},
      {input: {intervals: [[1, 2, 3]]}, expected: {error: 'invalid_intervals'}}
    ]
  },
  {
    id: 'stable-dedupe',
    name: 'Deduplicar valores conservando orden y tipos',
    task: 'Implementa function transform(input) como función pura de JSON. Entrada: {values:[...]}, una lista de primitivos JSON: null, booleanos, cadenas y números finitos. Salida exacta: {values:[...]}, conservando solo la primera aparición de cada valor en su orden original. La igualdad respeta los tipos: 1, "1" y true son tres valores distintos, igual que null y "null"; 0 y -0 son el mismo valor. No ordenes, no conviertas tipos y no uses claves de objetos que confundan "__proto__" o "constructor". La lista vacía devuelve {values:[]}. Si input no es un objeto con values válido, o contiene objetos/listas/otros tipos, devuelve exactamente {error:"invalid_values"}. No imports, red, archivos, procesos, cambios del servidor ni entrenamiento de pesos. Formula la solución, intenta refutarla con casos límite y corrige antes de devolver el código y tus ejemplos.',
    learningPlan: {
      hypothesis: 'La igualdad con tipos y la primera aparición permiten eliminar duplicados sin perder información de orden.',
      refutations: ['1, "1" y true no representan el mismo valor.', 'Cadenas con nombres especiales no son propiedades de un diccionario.', 'Valores falsos y null siguen siendo elementos válidos.'],
      evidence: 'Comparar valores y orden exactos con ocho casos externos al generador; un fallo refuta la candidata.',
      scope: 'Herramienta de transformación JSON; no modifica el servidor ni los pesos del modelo.'
    },
    acceptanceTests: [
      {input: {values: []}, expected: {values: []}},
      {input: {values: [3, 1, 3, 2, 1, 2]}, expected: {values: [3, 1, 2]}},
      {input: {values: [1, '1', true, 1, '1', true, false, 0, '0', null, 'null', null]}, expected: {values: [1, '1', true, false, 0, '0', null, 'null']}},
      {input: {values: ['', false, null, 0, '', 0, false, null]}, expected: {values: ['', false, null, 0]}},
      {input: {values: ['__proto__', 'constructor', 'toString', '__proto__', 'constructor']}, expected: {values: ['__proto__', 'constructor', 'toString']}},
      {input: {values: ['á', 'a', 'A', '🌍', 'á', '🌍', 'a ']}, expected: {values: ['á', 'a', 'A', '🌍', 'a ']}},
      {input: {values: [1, {value: 1}]}, expected: {error: 'invalid_values'}},
      {input: {values: 'abc'}, expected: {error: 'invalid_values'}}
    ]
  },
  {
    id: 'numeric-statistics',
    name: 'Calcular estadísticas numéricas',
    task: 'Implementa function transform(input) como función pura de JSON. Entrada: {values:[...]}, lista de números finitos cuya suma permanece finita. Salida exacta: {count,sum,min,max,mean,median}. count es longitud; sum suma de izquierda a derecha; min y max extremos; mean=sum/count; median es el elemento central de una copia ordenada NUMÉRICAMENTE, o la media de los dos centrales si count es par. No redondees ni conviertas cadenas. Para lista vacía devuelve {count:0,sum:0,min:null,max:null,mean:null,median:null}. Si input no es un objeto con values válido, hay valores que no son números finitos o la suma deja de ser finita, devuelve exactamente {error:"invalid_numbers"}. No imports, red, archivos, procesos, cambios del servidor ni entrenamiento de pesos. Formula la solución, intenta refutarla con casos límite y corrige antes de devolver el código y tus ejemplos.',
    learningPlan: {
      hypothesis: 'Acumular la suma y ordenar numéricamente permite calcular estadísticas comprobables, con vacío definido explícitamente.',
      refutations: ['La ordenación lexicográfica falla con 2 y 10.', 'Medianas pares e impares requieren reglas distintas.', 'Lista vacía, números negativos, fracciones y falsas entradas numéricas.'],
      evidence: 'Comparar las seis magnitudes con ocho casos externos al generador; los ejemplos propios no bastan.',
      scope: 'Herramienta de transformación JSON; no modifica el servidor ni los pesos del modelo.'
    },
    acceptanceTests: [
      {input: {values: []}, expected: {count: 0, sum: 0, min: null, max: null, mean: null, median: null}},
      {input: {values: [7]}, expected: {count: 1, sum: 7, min: 7, max: 7, mean: 7, median: 7}},
      {input: {values: [10, 2, 3]}, expected: {count: 3, sum: 15, min: 2, max: 10, mean: 5, median: 3}},
      {input: {values: [10, 2, 4, 8]}, expected: {count: 4, sum: 24, min: 2, max: 10, mean: 6, median: 6}},
      {input: {values: [-8, -2, -5]}, expected: {count: 3, sum: -15, min: -8, max: -2, mean: -5, median: -5}},
      {input: {values: [0.5, 0.25, 0.75, 0.5]}, expected: {count: 4, sum: 2, min: 0.25, max: 0.75, mean: 0.5, median: 0.5}},
      {input: {values: [1, '2']}, expected: {error: 'invalid_numbers'}},
      {input: {values: [1e308, 1e308]}, expected: {error: 'invalid_numbers'}}
    ]
  }
];

/** Returns an isolated copy, so a generated candidate cannot edit the contract. */
export function getAutonomousTask(id) {
  const task = TASKS.find(item => item.id === id);
  return task ? structuredClone(task) : null;
}

function taskId(item) {
  return item?.curriculumTaskId ?? item?.taskId;
}

function attemptRecords(history) {
  const seen = new Set();
  return history.flatMap(entry => {
    const candidate = entry?.candidate ?? entry;
    if (!candidate || typeof candidate.passed !== 'boolean' || !taskId(candidate)) return [];
    // A persisted candidate may also appear as a review result: count it once.
    if (candidate.id && seen.has(candidate.id)) return [];
    if (candidate.id) seen.add(candidate.id);
    return [{taskId: taskId(candidate), passed: candidate.passed, at: candidate.at ?? entry.at}];
  });
}

/**
 * One attempt means one buildExtension call, including its internal repairs.
 * Records: {taskId|curriculumTaskId, passed, at}, or {at, candidate:{...}}.
 * Three recorded attempts exhaust a task; a failure also requires 24h before
 * retry. The caller must retain these records across restarts. This selector
 * does not start processes, invoke a model, or change existing tools.
 */
export function selectAutonomousTask(extensions = [], history = [], {now = Date.now()} = {}) {
  if (!Array.isArray(extensions) || !Array.isArray(history)) throw new TypeError('Extensiones e historial deben ser listas.');
  const currentTime = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(currentTime)) throw new TypeError('La fecha de selección no es válida.');
  const attempts = attemptRecords([...extensions.filter(item=>item?.id&&item.at),...history]);
  for (const task of TASKS) {
    if (extensions.some(item => item?.passed === true && taskId(item) === task.id)) continue;
    const records = attempts.filter(item => item.taskId === task.id);
    if (records.length >= MAX_ATTEMPTS) continue;
    const coolingDown = records.filter(item => !item.passed).some(item => {
      const failedAt = typeof item.at === 'number' ? item.at : Date.parse(item.at);
      // An untimed failure cannot safely be treated as an old failure.
      return !Number.isFinite(failedAt) || currentTime - failedAt < FAILURE_COOLDOWN_MS;
    });
    if (!coolingDown) return getAutonomousTask(task.id);
  }
  return null;
}
