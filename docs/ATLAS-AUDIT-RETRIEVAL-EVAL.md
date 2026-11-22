# Auditoría incremental: integridad de recuperación y evaluación

## Comparación con buenas prácticas de sistemas de agentes
- **LangGraph**: ejecución con estado, checkpoints y supervisión. Atlas tiene cola persistente, pero el registro de la espiral todavía no está conectado a checkpoints de ejecución.
- **OpenHands**: cambios de código contrastados con pruebas. Atlas cuenta con CI y evaluación conservadora; no se deben confundir pruebas estáticas con benchmarks de inteligencia.
- **Sentence Transformers / BGE-M3**: recuperación semántica con embeddings. Atlas ya tiene un punto de fusión opcional, pero no se ha conectado un codificador ni medido recall/nDCG en corpus real.
- **Qwen / Phi**: modelos abiertos que requieren validación de licencia, memoria y disponibilidad del runtime. Atlas no debe afirmar que están instalados.

## Hallazgos y reparaciones
1. **P0, puntuaciones incompatibles**: el reranker híbrido mezclaba puntuaciones fusionadas con léxicas sin normalización común cuando faltaban embeddings. Reparado: la fusión solo se usa con cobertura completa de similitudes válidas; de lo contrario se conserva la clasificación léxica.
2. **P0, evaluación A/B no emparejada**: se podían comparar muestras de distinto tamaño y permitir umbrales no finitos. Reparado: rechazar cohortes de distinto tamaño y umbrales inválidos. **Límite:** tamaños iguales no prueban identidad de las preguntas; añadir hashes de corpus en la próxima iteración.
3. **P1, registro de espiral aislado**: `atlas-spiral-time.mjs` es puro, no persiste ni observa herramientas. Próxima fase: almacén privado append-only, enlace a ejecuciones Ion verificadas y recuperación tras reinicios.
4. **P1, integración incompleta de Lía**: chat canónico y Atlas Core conservan almacenes distintos; no migrar datos sin diseño de aislamiento y consentimiento.
5. **P1, benchmarking ausente**: sin medidas reales de recall, latencia y memoria no hay justificación para activar un nuevo modelo.

## Reglas de promoción
- Cualquier cambio de modelo, memoria o agente requiere pruebas, comparabilidad del corpus, revisión humana y rollback.
- Las métricas son evidencias de una tarea concreta, no demostración de conciencia, comprensión universal o leyes físicas.
- El vértice Dios/Suceso se registra como sorpresa o contradicción, no como un agente con poderes especiales.
- No se modifican `main`, pesos, servicios de pago ni instalaciones locales desde esta rama.
