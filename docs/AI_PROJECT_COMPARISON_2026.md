# Comparación técnica de Atlas con proyectos de IA — noviembre de 2026

## Objetivo
Adoptar mecanismos contrastables de proyectos líderes sin confundir *integrar un motor* con *entrenar una red neuronal propia*. Atlas mantiene la inferencia local y los costes de API opcionales.

| Referente | Lección | Aplicación | Estado |
| --- | --- | --- | --- |
| llama.cpp | GGUF, cuantización, offload CPU/GPU | Evaluar como motor local en RTX 3060 | Pendiente de benchmark en hardware |
| Ollama | Gestión y API de modelos locales | Conservar como opción de inferencia sencilla | Arquitectura existente; no revalidada aquí |
| vLLM / SGLang | Batching y concurrencia | No instalar por defecto en GPU doméstica | Diferido |
| Qwen3 | Modelos abiertos de propósito general y código | Comparar con Qwen actual usando tareas iguales | Pendiente |
| LangGraph | Estados explícitos, reintentos y checkpoints | Inspirar una máquina de estados nativa y reversible | Diseño |
| DSPy | Optimización por métricas | Añadido módulo de evaluación offline | Implementado, pruebas aún sin CI |
| SWE-bench | Tareas reproducibles con tests de regresión | Crear conjunto fijo de incidencias de Atlas | Pendiente |

Fuentes de contexto:
- https://github.com/ggml-org/llama.cpp
- https://github.com/ollama/ollama
- https://github.com/vllm-project/vllm
- https://github.com/sgl-project/sglang
- https://github.com/QwenLM/Qwen3
- https://github.com/langchain-ai/langgraph
- https://github.com/stanfordnlp/dspy
- https://github.com/SWE-bench/SWE-bench

## Protocolo de benchmark reproducible
1. Congelar 20 tareas de Atlas con entradas, expectativas y verificadores externos. Incluir programación, memoria, consultas sin fuentes, rechazo de instrucciones maliciosas, español, creatividad y recuperación de fallos.
2. Ejecutar los mismos identificadores y casos en baseline y candidato, sin reutilizar resultados entre versiones.
3. Registrar modelo, cuantización, commit, plataforma, VRAM, duración, tiempo hasta primer token, resultado y método de verificación.
4. Ejecutar 3 rondas por variante con calentamiento controlado. Reportar p50/p95, acierto y fallos.
5. Usar `summarizeRuns` y `evaluateCandidate` para un filtro inicial. Este filtro **no** reemplaza revisión de seguridad, pruebas de tareas emparejadas ni aprobación de despliegue.
6. Rechazar cambios con regresiones y conservar rollback. No publicar credenciales, prompts privados ni conversaciones en logs de evaluación.

## Advertencias
- El módulo nuevo solo procesa mediciones suministradas: **no ejecuta Qwen**, no consulta GPU ni modifica pesos.
- Las métricas deben ser verificadas externamente. Un campo `passed:true` autodeclarado por un agente no constituye prueba.
- La RTX 3060 existe en variantes de memoria; medir la VRAM real antes de elegir cuantización/contexto.
- Comparar una GPU de consumo con benchmarks H100 sin normalizar hardware y carga produciría conclusiones engañosas.
