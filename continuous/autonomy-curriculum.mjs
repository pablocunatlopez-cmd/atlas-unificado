import {jsonPatchTask} from './capability-json-patch.mjs';
import {csvTask} from './capability-csv.mjs';

const MAX_ATTEMPTS = 3;
const FAILURE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// These examples are written independently of generated code. Passing them is
// evidence for a bounded JSON tool, never evidence of general intelligence.
const TASKS = [
  {
    id: 'lor-omega-schema',
    name: 'LOR-ΩΣ · estructura S*',
    task: 'Implementa function transform(input) como función pura de JSON. Comprueba SOLO la estructura de input.S del lenguaje original LOR-ΩΣ. Los doce campos obligatorios, en este orden, son O,A,X,R,T,I,C,E,M,P,F,Σ. E significa escala y A ambiente; no cambies esos símbolos. S debe ser un objeto JSON no nulo y no un array. Salida exacta: {valid:boolean,missing:string[],extra:string[]}. missing enumera los campos obligatorios ausentes en el orden indicado; extra enumera las claves propias desconocidas de S ordenadas lexicográficamente. valid es true únicamente si S tiene formato correcto, no faltan campos y no hay claves desconocidas. Se comprueba presencia de claves, no sus valores: un campo presente con null cuenta como presente. Si input o S no tienen formato correcto, devuelve valid:false, missing con los doce símbolos y extra:[]. No escribas una explicación física ni evalúes la verdad de una hipótesis. No imports, exports, red, archivos, procesos, relojes ni cambios de pesos. Conserva la entrada y devuelve únicamente el código completo.',
    learningPlan: {
      hypothesis: 'Un contrato de claves convierte la estructura S* original en una herramienta ejecutable que Atlas puede construir y refutar.',
      refutations: ['Un campo presente con null no está ausente.', 'E es escala y su omisión debe detectarse sin confundirlo con A, ambiente.', 'Arrays, cadenas, valores nulos y claves adicionales no cumplen el esquema.'],
      evidence: 'Ejecutar ocho contratos escritos fuera del modelo, conservar fallos y publicar la herramienta únicamente si todos pasan.',
      scope: 'Validador estructural de JSON para LOR-ΩΣ; no modifica el servidor ni los pesos de Qwen, ni demuestra una teoría física.'
    },
    acceptanceTests: [
      {input: {S: {O: null, A: null, X: null, R: null, T: null, I: null, C: null, E: null, M: null, P: null, F: null, 'Σ': null}}, expected: {valid: true, missing: [], extra: []}},
      {input: {S: {O: [], A: 'ambiente', X: [], R: [], T: [], I: [], C: [], M: [], P: [], F: [], 'Σ': []}}, expected: {valid: false, missing: ['E'], extra: []}},
      {input: {S: {O: 0, A: 0, X: 0, R: 0, T: 0, I: 0, C: 0, E: 0, M: 0, P: 0, F: 0, 'Σ': 0, foo: 1, bar: 2}}, expected: {valid: false, missing: [], extra: ['bar', 'foo']}},
      {input: null, expected: {valid: false, missing: ['O', 'A', 'X', 'R', 'T', 'I', 'C', 'E', 'M', 'P', 'F', 'Σ'], extra: []}},
      {input: {}, expected: {valid: false, missing: ['O', 'A', 'X', 'R', 'T', 'I', 'C', 'E', 'M', 'P', 'F', 'Σ'], extra: []}},
      {input: {S: []}, expected: {valid: false, missing: ['O', 'A', 'X', 'R', 'T', 'I', 'C', 'E', 'M', 'P', 'F', 'Σ'], extra: []}},
      {input: {S: 'O,A,X,R,T,I,C,E,M,P,F,Σ'}, expected: {valid: false, missing: ['O', 'A', 'X', 'R', 'T', 'I', 'C', 'E', 'M', 'P', 'F', 'Σ'], extra: []}},
      {input: {S: {O: []}}, expected: {valid: false, missing: ['A', 'X', 'R', 'T', 'I', 'C', 'E', 'M', 'P', 'F', 'Σ'], extra: []}}
    ]
  },
  {
    id: 'json-pointer-resolve',
    name: 'Resolver referencias JSON Pointer',
    task: 'Implementa function transform(input) como función pura de JSON para consultar documentación estructurada. Entrada: {document:valorJSON,pointer:cadena}. Usa la representación de cadena de JSON Pointer de RFC 6901, no fragmentos URI: la cadena vacía selecciona el documento entero; cualquier otra comienza por /. Divide en tokens por / y decodifica ~1 como / y después ~0 como ~, sin doble decodificación: ~01 significa ~1. Los tokens vacíos son claves válidas; no decodifiques porcentajes. Valida toda la sintaxis antes de recorrer: un ~ que no vaya seguido de 0 o 1 es inválido. En objetos busca solo claves propias exactas, nunca propiedades heredadas. En arrays solo admite índices 0 o un entero decimal sin ceros iniciales y dentro del rango; - no selecciona ningún elemento. No conviertas tipos ni sigas rutas a través de null o primitivos. Éxito exacto: {found:true,value:valor}, incluso si el valor es null. Si la entrada no es un objeto no nulo y no array, falta la clave propia document o pointer no es cadena: {found:false,error:"invalid_input"}. Si la sintaxis de pointer es inválida: {found:false,error:"invalid_pointer"}. Si no se resuelve algún token: {found:false,error:"not_found"}. Conserva la entrada. No imports, red, archivos, procesos, relojes ni cambios de pesos. Devuelve el código y tus ejemplos. Especificación pública: https://www.rfc-editor.org/rfc/rfc6901.html, secciones 3-5; los códigos de error son el contrato de esta aplicación.',
    learningPlan: {
      hypothesis: 'Referencias estructurales exactas permiten recuperar un valor documental sin confundir claves, índices ni valores nulos.',
      refutations: ['~01 no debe convertirse en una barra.', 'Un índice 01 y el marcador - no resuelven un elemento de array.', 'Una propiedad heredada no es un dato del documento y un valor null sí puede ser un resultado.'],
      evidence: 'Ocho salidas especificadas fuera del generador contrastan raíz, escapes, arrays, herencia y errores de formato.',
      scope: 'Consulta de JSON ya disponible; no navega por Internet, no modifica documentos ni el servidor ni los pesos de Qwen.'
    },
    acceptanceTests: [
      {input: {document: {title: 'Atlas', sections: []}, pointer: ''}, expected: {found: true, value: {title: 'Atlas', sections: []}}},
      {input: {document: {'~1': {'a/b': {'': null}}}, pointer: '/~01/a~1b/'}, expected: {found: true, value: null}},
      {input: {document: {sections: [{title: 'Inicio'}, {title: 'Pruebas'}]}, pointer: '/sections/1/title'}, expected: {found: true, value: 'Pruebas'}},
      {input: {document: {}, pointer: '/constructor'}, expected: {found: false, error: 'not_found'}},
      {input: {document: {'a~2b': 7}, pointer: '/a~2b'}, expected: {found: false, error: 'invalid_pointer'}},
      {input: {document: ['cero', 'uno'], pointer: '/01'}, expected: {found: false, error: 'not_found'}},
      {input: {document: ['cero'], pointer: '/-'}, expected: {found: false, error: 'not_found'}},
      {input: {document: null}, expected: {found: false, error: 'invalid_input'}}
    ]
  },
  {
    id: 'dag-dependency-plan',
    name: 'Planificar dependencias de proyectos',
    task: 'Implementa function transform(input) como función pura de JSON para ordenar trabajo, sin ejecutarlo. Entrada: {tasks:[{id:cadenaNoVacia,dependsOn:[id,...]},...]}. Cada id debe ser único; cada dependencia debe ser una cadena que nombre un id existente. Las dependencias repetidas cuentan una sola vez; las demás propiedades de cada tarea se ignoran. Si input no es un objeto no nulo y no array, tasks no es array, una tarea no es objeto válido, falta un id no vacío o dependsOn no es array de ids válidos, hay ids duplicados o dependencias desconocidas, devuelve exactamente {error:"invalid_tasks"}. Una dependencia de sí misma es un ciclo válido para el diagnóstico, no un error de formato. Produce {order:[ids],blocked:[ids]}. Cada paso toma el id lexicográficamente menor entre TODOS los nodos aún no elegidos cuyas dependencias ya están en order; actualiza los candidatos tras cada elección, no por tandas. Usa el orden de cadenas de Array.sort() sin comparador, no el orden de entrada ni localeCompare. Si todos se resuelven, blocked es []; si hay ciclos, order conserva solo los nodos resolubles y blocked enumera TODOS los restantes, incluidos descendientes de ciclos, ordenados lexicográficamente. Vacío: {order:[],blocked:[]}. Conserva la entrada y no ejecutes tareas. No imports, red, archivos, procesos, relojes, cambios del servidor ni entrenamiento de pesos. Formula la solución, busca contraejemplos y devuelve el código y tus ejemplos.',
    learningPlan: {
      hypothesis: 'Elegir en cada paso la menor tarea lista permite un plan topológico reproducible y separa los nodos bloqueados sin ejecutar acciones.',
      refutations: ['Una tarea recién desbloqueada puede preceder lexicográficamente a otra que ya estaba lista.', 'Una dependencia duplicada no crea trabajo adicional ni un ciclo.', 'Un ciclo bloquea también a sus descendientes, pero no a componentes independientes.'],
      evidence: 'Ocho contratos externos comparan orden exacto, diagnósticos de ciclos y rechazo de referencias inválidas.',
      scope: 'Plan de datos para proyectos; no modifica el servidor ni los pesos de Qwen y no ejecuta acciones.'
    },
    acceptanceTests: [
      {input: {tasks: []}, expected: {order: [], blocked: []}},
      {input: {tasks: [{id: 'deploy', dependsOn: ['test']}, {id: 'test', dependsOn: ['build']}, {id: 'build', dependsOn: []}]}, expected: {order: ['build', 'test', 'deploy'], blocked: []}},
      {input: {tasks: [{id: 'c', dependsOn: []}, {id: 'a', dependsOn: ['b']}, {id: 'b', dependsOn: []}]}, expected: {order: ['b', 'a', 'c'], blocked: []}},
      {input: {tasks: [{id: 'b', dependsOn: ['a', 'a']}, {id: 'a', dependsOn: []}]}, expected: {order: ['a', 'b'], blocked: []}},
      {input: {tasks: [{id: 'c', dependsOn: ['b']}, {id: 'b', dependsOn: ['a']}, {id: 'z', dependsOn: []}, {id: 'a', dependsOn: ['b']}]}, expected: {order: ['z'], blocked: ['a', 'b', 'c']}},
      {input: {tasks: [{id: 'self', dependsOn: ['self']}, {id: 'root', dependsOn: []}]}, expected: {order: ['root'], blocked: ['self']}},
      {input: {tasks: [{id: 'build', dependsOn: ['missing']}]}, expected: {error: 'invalid_tasks'}},
      {input: {tasks: [{id: 'same', dependsOn: []}, {id: 'same', dependsOn: []}]}, expected: {error: 'invalid_tasks'}}
    ]
  },
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
 ,jsonPatchTask,csvTask
];

export const AUTONOMOUS_TASK_IDS=Object.freeze(TASKS.map(task=>task.id));

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
