# Empujón al ciclo autónomo de Atlas

La comprobación de las 17:36 UTC encontró el coordinador habilitado y sin pausa. La última auditoría había terminado a las 17:25; seis herramientas estaban aprobadas y la política activa era generación 2. El catálogo inicial de cuatro tareas se había completado. En los cien registros de política retenidos había 96 propuestas sin mejora, dos regresiones y dos promociones; repetir actividad no se contabiliza como aprendizaje.

## Cambios

- El currículo añade JSON Pointer RFC 6901 y planificación topológica de dependencias, con ocho contratos externos cada una. Se conservaron los identificadores, casos y resultados anteriores. Estas son tareas de datos; no ejecutan proyectos ni leen archivos.
- La propuesta de política conserva la regla intentada y sus métricas públicas de desarrollo. La siguiente propuesta recibe esas refutaciones, sin preguntas, métricas ni identificadores de los casos reservados. Cuando todo el desarrollo pasa, deja de pedir un fallo inexistente. Los requisitos de promoción y recuperación siguen iguales.
- El coordinador vuelve a comprobar qué tarea queda disponible al cerrar cada revisión. Si hay trabajo elegible, programa cinco minutos; respeta los intentos agotados, el cooldown de fallos y la prioridad del chat.
- Las reparaciones conservan su identidad curricular y contratos externos para poder utilizarse después en el chat y en la preparación de candidatos de entrenamiento.
- El filtro AST permite claves JSON como `input.document` sin permitir la referencia global `document`, expresiones computadas peligrosas, shell o archivos. Las barreras de constructor y prototipo se conservan.
- La telemetría de agentes refleja el trabajo y los contadores reales de los tres constructores, incluido el nativo. El chat compartido reconoce peticiones concretas de JSON Pointer y dependencias únicamente cuando hay datos JSON y una herramienta canónica aprobada.

## Verificación

Las pruebas focalizadas de currículo, auditoría, contratos, política, aislamiento, selección, estado de ejecución y herramientas públicas aprobaron 67/67 sin GPU. Después se recargó el coordinador y se iniciaron rondas reales mediante su API autenticada, sin escribir las implementaciones de las herramientas por Codex.

La primera ronda, terminada a las 17:45 UTC, intentó JSON Pointer con el constructor nativo: sus tres versiones fallaron los contratos. La candidata permanece rechazada y no se ofreció como herramienta ni contó como aprendizaje. El fallo se incorporó a las métricas del selector. La segunda ronda empezó a las 17:46 UTC para la tarea pendiente de dependencias.

El proceso conserva la RTX 3060 y Qwen local como motor. Aider y smolagents son frameworks ejecutados con ese mismo modelo, no modelos independientes. El entrenamiento de candidatos LoRA sigue separado y ningún adaptador se activa por el hecho de terminar una revisión. Esta intervención no acredita superioridad general ni mejora de pesos.

## Resultado real y cierre de verificación

La ronda de dependencias terminó a las 17:50 UTC. Tras un intento Aider rechazado y un fallo de inferencia, el constructor nativo produjo una candidata que aprobó los ocho contratos en su tercer intento. Se incorporó como séptima herramienta aprobada; el código de la función lo generó Qwen, no Codex. La candidata JSON Pointer sigue rechazada y con su cooldown.

El chat compartido ejecutó después un proyecto nuevo de cuatro tareas y obtuvo exactamente order=[build,docs,test,release], blocked=[]. No utilizó fuentes ni memoria privada. La revisión de la respuesta detectó una arista inventada por la redacción del modelo; se corrigió el camino directo del planificador para representar el resultado mediante un formateador determinista que valida partición y precedencias, sin añadir aristas, optimalidad, UUID o ejecuciones ficticias. Las solicitudes explícitas de revisión, Internet, colaboradores o adjuntos mantienen su camino habitual. La prueba HTTP final de las 17:58 UTC confirmó model=atlas-coordinator, resultado correcto, cero generaciones adicionales para redactarlo y memoria/fuentes privadas en cero.

La prueba real del núcleo con el feedback nuevo conservó la regla propuesta y las métricas de desarrollo; el resultado 9/9→9/9 sin ahorro se rechazó como no_measured_improvement. No se promovió una mejora inexistente ni cambiaron los pesos activos.

La comprobación final de código pasó 93/93 pruebas focalizadas. El servicio se recargó y volvió a responder con Qwen3.5-9B en CUDA. La auditoría autónoma permanece habilitada: cinco minutos cuando hay tareas elegibles; con las tareas nuevas resueltas o en cooldown conserva la cadencia normal. El supervisor y la investigación de fuentes continúan, respetando la parada del usuario y la prioridad del chat.
