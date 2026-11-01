# Núcleo ejecutable de Atlas y LOR-ΩΣ

`cognitive-core.mjs` añade una política real y mutable al programa de Atlas. La política selecciona estrategia, presupuesto de razonamiento y revisión mediante datos JSON ejecutados por un intérprete cerrado. Qwen puede proponer reglas nuevas y ajustar las existentes. No puede añadir JavaScript, predicados, acceso a archivos, comandos, permisos ni pesos mediante este mecanismo.

Esta capa se llama **StrategyPolicy**. Es distinta del lenguaje original **LOR-ΩΣ** del usuario y del núcleo neuronal de Qwen. El código de las capas de política y herramientas puede evolucionar sin modificar los miles de millones de parámetros del modelo. No se debe presentar una mejora de enrutamiento como entrenamiento de Qwen, consciencia ni superioridad general.

Las propuestas nuevas usan `schema: "atlas-strategy-change/v1"` y `operation: "upsert-rule"`: Qwen propone **una sola regla** junto con nombre y justificación. El intérprete copia la política vigente y añade o reemplaza exclusivamente esa regla. Conserva todas las demás y el fallback; los contratos siguen pudiendo refutar el cambio. Esta edición pequeña evita que arreglar una definición destruya otras decisiones correctas. El lector mantiene compatibilidad con las políticas completas del formato anterior, que también deben superar las mismas comprobaciones.

## Ejecución del ciclo

1. Observar la versión vigente contra los casos de desarrollo.
2. Pedir a Qwen una hipótesis y una política candidata como JSON.
3. Comprobar tipos, reglas, predicados, prioridades y presupuestos.
4. Generar un lote nuevo de contratos externos parametrizados, separado del prompt enviado a Qwen.
5. Comparar vigente y candidato sobre el mismo lote y conservar también las regresiones y refutaciones.
6. Promover únicamente si todos los contratos pasan, no hay regresiones y mejora la puntuación o se reduce al menos un 15% el presupuesto medio con igual puntuación.
7. Guardar versión anterior, candidato, métricas, hash del lote y registro LOR. Permitir recuperar cualquier versión conservada mediante `rollback`.

Los contratos comprueban enrutamiento y presupuesto. Las familias son saludos, definiciones, programación, matemática, investigación, creación, memoria, conversación y transporte JSON. Sus plantillas son código visible y no constituyen un benchmark secreto de inteligencia. Los casos exactos del lote no se envían al generador y un hash ya consumido no puede volver a emplearse para promover. Repetir un candidato sin mejora no incrementa el contador de aprendizaje.

La generación de un candidato, su puntuación o su autorrevisión no acreditan la calidad de las respuestas finales. El sistema requiere evaluaciones adicionales para atribuir mejoras en programación, precisión factual o capacidad general.

## API de integración

```js
const core = createCognitiveCore({directory});
await core.initialize();
const directive = await core.decide(question, {json, structured, hasMemory, internet, tools});
const cycle = await core.propose(async (prompt, {signal}) => localQwenJSON(prompt, signal), {signal});
const status = await core.status();
await core.rollback(versionId, {reason});
```

La decisión incluye `schema: 'atlas-cognitive-decision/v1'`, `strategy`, `thinkingTokens`, `review`, `seekEvidence`, `permissions`, `versionId`, `versionHash` y `generation`. `thinkingTokens` está entre 0 y 1536. Internet y herramientas siempre dependen de la autorización del turno. Las llamadas estructuradas se fuerzan a estrategia directa, cero razonamiento y ninguna revisión adicional, para preservar el formato. Las instrucciones explícitas del usuario siguen por encima de las recomendaciones de política.

La integración con el chat y el coordinador utiliza esta API; el módulo no arranca servidores ni inferencias por su cuenta. `propose` recibe un callback local, admite cancelación y serializa sus escrituras. Los archivos de ejecución se guardan en `data/cognitive-core/`; no deben publicarse junto con historiales personales.

## LOR original recuperado

`lor-omega.mjs` codifica registros del lenguaje conservado en `atlas-cloud/data/core.json`, documento `Atlas_Unificado_LOR-OmegaSigma.md`, versión 105, fecha 2026-09-12, SHA-256 `6f26f5a842d8088d02b4c0873e0e59c69ff5aae00490f46e6aafbd891be74609`.

S* = ⟨O, A, X, R, T, I, C, E, M, P, F, Σ⟩ conserva objetos, ambiente, estados, relaciones, transformaciones, invariantes, restricciones, escala, medida, predicciones, falsadores y cadena semiótica. `E` significa escala; no evidencia. `A` significa ambiente; no conexión geométrica.

K declara objeto, ambiente, perspectiva y escala. Λ convierte un ambiente en objeto dentro de otro ambiente y conserva el marco anterior. Γ declara Animal, Mente, Suceso y Realidad. En una evaluación de software: Animal registra el ejecutor y recursos, Mente la versión y propuesta, Suceso el lote/ambiente y Realidad las medidas ejecutadas. Esta es una aplicación situada del marco, no una demostración de causalidad física ni una afirmación metafísica.

`L.countsAsLearning` solo es verdadero cuando hay evidencia nueva, cambio aceptado e invariantes preservadas. Una propuesta inválida o refutada conserva su registro sin contar como aprendizaje. Los registros declaran explícitamente que esta tarea no calcula curvatura, transporte geométrico ni holonomía. Los módulos históricos reales de `components/atlas597/lor` siguen conservados y requieren ejecución y validación propias antes de atribuir resultados nuevos.

## Comprobación

`node --test cognitive-core.test.mjs lor-omega.test.mjs` comprueba promoción medida, regresiones, no reutilizar evaluaciones, integridad, cancelación, recuperación de la línea base, permisos, transporte JSON y consistencia de los símbolos originales. No usa GPU y no sustituye una prueba real con Qwen.
