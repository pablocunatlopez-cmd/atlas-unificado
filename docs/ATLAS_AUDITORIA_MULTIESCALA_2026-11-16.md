# Auditoría de Atlas Unificado: del sistema al dato (2026-11-16)

## Alcance y evidencia
Inspección estática de la rama `audit/atlas-verification-2026-11-16` y su árbol GitHub (1.043 ficheros, 299 ficheros de prueba; conteo del árbol anterior a esta auditoría). Se revisaron contratos del chat, cola cloud, puente local, diario de hipótesis, memoria/RAG, evaluación, políticas de recuperación, sandbox de parches y documentación. No se ejecutó el modelo local, el PC, ni el sitio publicado. Las pruebas GitHub Actions exitosas validan la suite definida, no calidad general de respuestas, rendimiento real ni seguridad integral.

## Zoom 1: propósito
Atlas es un asistente local y un entorno de herramientas, investigación, creación y experimentación. La casa y el mundo interior de Lía son visualizaciones del estado **registrado**, no evidencia de conciencia. Los vértices filosóficos son Mundo Mental (Atlas), Mundo Físico (Ion) y Dios/Suceso (acontecimiento inesperado que obliga a revisar el modelo); la espiral describe la evolución temporal revisable. Objetivo de ingeniería: respuestas útiles y trazables con presupuesto local, permisos explícitos y cambios reversibles.

## Zoom 2: arquitectura real
- `continuous/`: chat Qwen, llama.cpp, herramientas, recuperación, pruebas, evaluación, propuesta de parches, control de permisos y puente saliente.
- `cloud/`: aplicación React/Next/vinext, cola D1, autenticación de propietario, APIs, escenas y visualización del historial.
- `docs/`: contratos y verificación. GitHub Actions comprueba una parte del código. No se debe confundir un commit verde con despliegue.
- Flujo: chat web → solicitud en cola → puente saliente autorizado → motor local → respuesta y auditoría → almacenamiento de job → vista Lía.
- Restricción de infraestructura: funcionamiento CPU sin GPU garantizada; no exigir servicios de pago, claves remotas ni descargas pesadas por defecto.

## Zoom 3: subsistemas y deuda
1. **Fiabilidad de chat**: existe revisión y auditoría de citas, pero un chequeo de etiqueta no prueba que la fuente respalde semánticamente la respuesta. Priorizar pruebas de afirmación→pasaje→cita, negativas y abstención.
2. **Memoria**: existe recuperación con ACL, revocación y vigencia. Recordar una frase no es demostrarla. La clasificación de conocimiento debe depender de comprobaciones registradas, no de etiquetas de evidencia aportadas por el modelo. Esta auditoría corrige esa frontera.
3. **RAG**: ya existen FTS5, laboratorio comparativo y reranker híbrido que no inventa embeddings. Antes de integrar un nuevo vector DB, medir recall, nDCG, citas, coste y latencia sobre corpus real autorizado y un conjunto reservado.
4. **Evaluación**: existen `atlas-evaluation-gate.mjs`, historia de evaluación, modelos emparejados y benchmark CPU. La carencia principal es **evidencia empírica suficiente**, no otro framework de optimización.
5. **Agencia/código**: ya existen propuestas, sandbox, hashes, aprobaciones y restauración. Mantener ejecución y publicación detrás de permisos del host; no habilitar auto-merge ni auto-modificación sin revisión.
6. **Nube y seguridad**: aislamiento de propietario en cola; validar entradas en ambos extremos. La integridad SHA-256 prueba coherencia de bytes, no autenticidad independiente del resultado. Un puente comprometido puede fabricar una cadena autoconsistente.
7. **Visualización**: el mundo interior muestra estados y eventos. Debe indicar claramente simulación, registro, ejecución real y nivel de verificación; no confundir animaciones con aprendizaje o mundo físico.
8. **Observabilidad**: añadir trazas locales con minimización/redacción de datos, opt-in, ID de ejecución y latencias; evitar publicar prompts privados o conversaciones en servicios externos.
9. **Operaciones**: controlar tamaño de modelos, memoria, tiempo de CPU, degradación sin GPU, recuperación tras cortes, copias y migraciones. Pruebas de unidad no sustituyen pruebas de apagado/arranque real.

## Zoom 4: fallo concreto corregido
`lia-knowledge-state.mjs` clasificaba una hipótesis como `check-supported` si aparecía una referencia con prefijo `tool-output:` y origen `tool`. Esos campos podían proceder del registro del modelo y no demostraban una ejecución comprobada. Ahora `lia-hypothesis-timeline.mjs` exige un evento de diario con integridad validada por la nube, estado y referencia coincidentes, y `lia-knowledge-state.mjs` exige ese indicador explícito. Se añadieron regresiones contra falsificación de etiquetas. **Límite**: validación criptográfica no autentica el motor local; la confianza sigue dependiendo de la frontera del puente.

## Herramientas públicas evaluadas (no instaladas automáticamente)
| Herramienta | Uso potencial | Decisión |
|---|---|---|
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | inferencia local CPU/GGUF, JSON estructurado, endpoint compatible | **Mantener**: ya existe en arquitectura; benchmark de versiones antes de actualizar |
| [Qwen3 Embedding 0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | recuperación semántica multilingüe | **Piloto opcional**: compararlo con FTS5 en CPU, sin activación automática |
| [pgvector](https://github.com/pgvector/pgvector) | índice vectorial Postgres | **Aplazar**: Atlas usa SQLite; añade operaciones sin prueba de necesidad |
| [Arize Phoenix](https://github.com/Arize-ai/phoenix) | trazas, experimentos, datasets | **Evaluar en local**: primero instrumentación mínima; controlar telemetría y datos privados |
| [DSPy](https://github.com/stanfordnlp/dspy) | optimización de prompts con métricas | **Aplazar** hasta disponer de evaluación emparejada y holdout fiable; evita sobreajuste |
| [Guardrails](https://github.com/guardrails-ai/guardrails) | validadores de entradas/salidas | **Adoptar principios**, no dependencia Python inmediata; el proyecto ya posee validadores tipados |

Estos proyectos tienen código accesible públicamente; comprobar licencia, pesos, versiones, dependencias y costes de infraestructura antes de integrar.

## Prioridad y criterios de aceptación
**P0 — Fiabilidad/procedencia**: no clasificar un registro como comprobado por etiquetas declaradas. Prueba negativa de spoofing y trazabilidad hasta evento autorizado. Implementación inicial en esta rama.

**P1 — Evaluación real**: corpus autorizado de al menos 100 preguntas diversas y reservado; mismo hash de corpus/protocolo para baseline y candidato; recall@5, nDCG@5, exactitud de citas revisada, latencia p95 y memoria; usar `atlas-evaluation-gate.mjs`. Ninguna mejora automática sin evidencia y aprobación.

**P2 — Recuperación híbrida opcional**: probar encoder local Qwen3 Embedding 0.6B frente a FTS5 en el mismo conjunto, midiendo latencia CPU y RAM. Activar solo si mejora calidad sin regresión inaceptable.

**P3 — Observabilidad y resiliencia**: IDs de traza, métricas locales sin contenido sensible, simulación de caída del puente y reintento, recuperación sin duplicados.

**P4 — Experiencia 3D/voz/ROS**: únicamente después de estabilizar la cadena de hechos y la infraestructura; el mundo físico exige hardware real, pruebas y autorización.

## Riesgos no resueltos
- Validación SHA-256 no equivale a firma, attestation de hardware ni verificación factual.
- El modelo puede crear afirmaciones y fuentes engañosas: el diario no las convierte en verdad.
- Coincidencia textual de hipótesis entre trabajos no demuestra identidad semántica ni aprendizaje.
- La vista de conocimiento está acotada a la conversación consultada; no es aún memoria transversal global.
- El benchmark existente y la suite de CI no demuestran tiempos reales ni calidad humana de la respuesta.
- Dependencias nuevas requieren revisión de licencias, supply chain, privacidad y recursos.

## Regla de integración
Ninguna herramienta externa se incorpora por popularidad. Primero: amenaza/objetivo → baseline → prototipo aislado → pruebas comparables → revisión de coste/privacidad → aprobación → integración reversible. Mantener rama draft; no publicar ni fusionar sin autorización.
