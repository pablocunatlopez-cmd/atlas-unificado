# Modelos neuronales gratuitos: selección e integración (2026-11-16)

## Criterios
- Gratis significa pesos disponibles sin licencia de API de pago; **no** significa coste de hardware o electricidad nulo.
- Priorizar memoria, CPU y compatibilidad; no descargar pesos ni instalar dependencias en esta rama.
- Cada candidato debe superar pruebas de calidad, latencia, RAM, privacidad y regresiones antes de activarse.
- El modelo generativo no debe atribuirse observaciones de Ion, hallazgos de Constelación ni descubrimientos del vértice Dios.

## Arquitectura de colocación
| Capa | Candidato | Integración |
|---|---|---|
| Atlas / Mundo Mental | Qwen3.5 4B; 9B como alternativa con RAM suficiente | catálogo consultivo `continuous/neural-model-catalog.mjs`; no reemplaza el motor local actual |
| Memoria y documentación | BGE-M3 (requiere adaptador de embeddings verificado) | `continuous/neural-hybrid-retrieval.mjs` + `searchDocuments`; necesita similitudes generadas realmente |
| Evaluación y contradicción | Phi-4-mini | candidato para revisiones contrastadas, sin aprobación automática de cambios |
| Ion / Mundo Físico | Herramientas verificadas, no un LLM con permisos ilimitados | no ejecutar acciones nuevas ni ampliar permisos |
| Dios / Suceso | Registro de sorpresas y revisión append-only | `continuous/atlas-spiral-time.mjs`; un modelo no determina por sí solo la verdad del suceso |

## Algoritmo de recuperación
1. Recuperación léxica existente, con trazabilidad y límites de resultados.
2. Si existe un codificador realmente instalado y autorizado, producir similitudes normalizadas para documentos candidatos.
3. Fusionar `alpha * score_lexico + (1-alpha) * ((cosine+1)/2)`; `alpha=0.7` inicial, sujeto a benchmark.
4. Si falta el codificador, mantener la búsqueda léxica sin inventar vectores.
5. No introducir resultados de otro usuario ni documentos no autorizados.

## Evaluación antes de producción
- Corpus español y multilingüe con 100+ preguntas y respuestas relevantes anotadas.
- Recall@5, nDCG@5, precisión de citas, latencia p50/p95 y consumo de memoria.
- Comparación A/B contra `searchDocuments` original; rollback ante regresiones.
- Pruebas adversarias: instrucciones incrustadas en documentos, falsos recuerdos y consultas ambiguas.
- Confirmación de la licencia exacta y del identificador disponible en el runtime antes de cualquier descarga.

## Fuentes de candidatos
- https://huggingface.co/collections/Qwen/qwen35
- https://huggingface.co/BAAI/bge-m3
- https://huggingface.co/microsoft/Phi-4-mini-instruct
- https://www.sbert.net/docs/sentence_transformer/usage/efficiency.html

## Estado honesto
Catálogo y fusionador de puntuaciones: implementados. Modelo neuronal instalado: **no comprobado**. Inferencia de embeddings: **no conectada**. Validación CI de la rama: pendiente de resultado del último commit. No hay despliegue ni modificación de `main`.

## Revisión de auditoría
Se retiró una entrada de embeddings cuya identidad upstream no estaba verificada. El catálogo no garantiza que las etiquetas Ollama coincidan con el registro disponible en el equipo. Se incorporó `continuous/atlas-evaluation-gate.mjs`: evaluación A/B conservadora con aprobación humana obligatoria y sin promoción automática.
