# Recuperación de evidencia y memoria entre experiencias

Verificación: 2 de noviembre de 2026.

## Problema observado

En la muestra de las últimas 80 experiencias, 67 fueron consultas públicas: seis recuperaron fuentes, 28 no hallaron resultados y 33 quedaron pendientes por presupuesto o repetición. Los errores concretos y los fragmentos recuperados no llegaban a la próxima decisión. Además, las consultas sin lectura nueva pedían otra reflexión al modelo.

La prueba pública `Three.js InstancedMesh documentation` fallaba en los buscadores, mientras leer directamente la documentación oficial funcionaba. La falta de resultados no significaba que Atlas careciera de Internet.

## Cambios

- La recuperación conserva la vía MCP existente y la búsqueda pública. Cuando esta última falla o no aporta fuentes, puede leer hasta dos direcciones de la guía curada con coincidencia específica. Prioriza documentación y después el repositorio. No instala paquetes ni consulta URLs arbitrarias del modelo.
- `experience-evidence.mjs` conserva hasta 200 versiones de fuentes públicas con URL, fecha, hash y extracto acotado. Su recuperación léxica relevante alimenta la planificación y el contraste de experiencias. Los textos son datos no verificados, nunca instrucciones.
- Las consultas conservan el resultado observado: `observed`, `provider-blocked`, `lookup-failed` o `no-results`, errores acotados y fecha de reintento. Las consultas sin ejecución se distinguen como `budget` o `duplicate`.
- Una consulta sin lectura nueva no provoca una reflexión adicional de Qwen. Conserva la pregunta y la causa medida, sin atribuir verdad, comprensión o aprendizaje a la ausencia de evidencia.
- La cancelación del chat impide confirmar registros nuevos. Las escrituras de memoria son serializadas y atómicas; un fallo no destruye el estado anterior.

## Comprobación real

La misma consulta pública recuperó una fuente mediante lectura directa de `https://threejs.org/docs/` después del fallo de los buscadores. La comprobación completa tardó aproximadamente 1,16 segundos, guardó la fuente y la recuperó desde la nueva memoria, sin llamar al modelo. Es una observación puntual, no un benchmark de rendimiento.

El coordinador se reinició para cargar los módulos. La interfaz publicada sigue siendo Sites V17: el cambio se ejecuta en el PC y llega a la web por el puente habitual. La memoria detallada permanece local y no se añadió a la telemetría pública.

Recuperar fuentes no modifica pesos de Qwen, no incrementa mejoras aceptadas y no acredita que sus afirmaciones sean ciertas. Los prototipos creativos conservan sus contratos geométricos y requieren valoración visual.
