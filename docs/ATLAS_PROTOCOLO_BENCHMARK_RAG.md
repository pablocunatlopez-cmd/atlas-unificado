# Atlas: protocolo reproducible de evaluación RAG (sin GPU ni API)

Este laboratorio compara **Atlas léxico** con **SQLite FTS5** sobre documentos entregados explícitamente al proceso. No accede a la memoria canónica, no descarga embeddings, no ejecuta Qwen ni despliega cambios.

## Ejecución

Desde la raíz del repositorio, con Node.js 22.20+:

```bash
node --test continuous/atlas-retrieval-synthetic-benchmark.test.mjs
node continuous/run-atlas-retrieval-report.mjs ./pruebas-rag.json ./informes
```

El archivo `pruebas-rag.json` debe tener esta estructura (ejemplo ilustrativo; no alcanza el mínimo recomendado de 100 casos):

```json
{
  "documents": [{"id":"doc1","title":"Órbita","text":"Q594 usa Órbita."}],
  "cases": [{"id":"q1","question":"Q594","relevantIds":["doc1"]}],
  "citationLabels": {"q1":{"atlas-lexical":true,"fts5":true}}
}
```

Las etiquetas `citationLabels` deben provenir de una revisión independiente del resultado correspondiente. **No deben inferirse automáticamente del acierto de recuperación.** Como el laboratorio no genera respuestas, las etiquetas del ejemplo y del test sintético son simuladas; **no prueban exactitud de citas de una respuesta real**.

## Interpretación

- El evaluador requiere 100 consultas por defecto; menos casos implican `insufficient-evidence`.
- Las búsquedas se alternan AB/BA, con una ronda de calentamiento y cinco de medición por defecto.
- Se informa recall@5, nDCG@5, precisión de etiquetas de cita, latencia p95 y RSS del proceso. RSS es memoria de **todo el proceso**, no memoria exclusiva de cada motor.
- El informe incluye métricas agregadas, huellas del corpus y del protocolo, y resultados por consulta con identificadores transformados en SHA-256.
- La huella del informe depende también de latencias y memoria medidas. Dos ejecuciones equivalentes pueden producir **huellas de informe distintas**; lo reproducible es el protocolo y la identificación del corpus, no una igualdad exacta de timings.
- Las huellas sin clave de identificadores previsibles son **seudonimización, no anonimización**. No publiques informes de datos sensibles sin revisar el riesgo de reidentificación.
- El gate nunca autoriza despliegue: `promote:false`. Toda decisión requiere revisión humana.

## Limitaciones antes de adoptar un nuevo motor

El conjunto de 100 casos es sintético, no representa conversaciones reales, diversidad lingüística ni consultas adversariales. Para una comparación real, preparar un conjunto autorizado, equilibrado y separado del entrenamiento, con relevancia etiquetada por evaluadores independientes, registrar versiones de hardware/Node y ejecutar varias sesiones. La recuperación híbrida y los embeddings aún no se miden aquí.
