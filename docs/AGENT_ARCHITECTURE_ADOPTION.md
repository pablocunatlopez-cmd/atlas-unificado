# Atlas · Adopción de patrones de agentes autónomos

## Integraciones añadidas en la rama de revisión

| Referente | Componente Atlas | Alcance real |
|---|---|---|
| SWE-agent / LangGraph | `bounded-agent-workflow.mjs` | Pasos allowlist, presupuesto temporal, trazas sin errores sensibles |
| Letta / MemGPT | `scoped-memory-index.mjs` | Índice en memoria por usuario y proyecto; clases episódica, semántica y negativa |
| Aider | CI, evaluación y plan de promoción | Revisiones en Git, pruebas y propuesta de rollback |
| OpenHands | Límites de herramientas y ejecución | Diseño de aislamiento; todavía sin sandbox de proceso |
| DSPy | Benchmarks emparejados y ranking | Comparación offline y adaptador Ollama local |

## Riesgos y condiciones de producción

1. El índice de memoria es **en RAM**: no almacena en disco, cifra, borra de copias externas ni autentica usuarios. El proceso que llama debe verificar el propietario antes de consultar.
2. El flujo de agentes **no es un sandbox**: un handler que ignore AbortSignal puede seguir ejecutándose después del timeout. Las operaciones no confiables requieren procesos aislados con kill y límites del sistema operativo.
3. Los eventos del flujo no guardan entradas ni resultados para reducir filtración de datos, pero `onEvent` es código proporcionado por el llamador y debe ser de confianza.
4. No activar autodespliegue. La promoción neuronal sigue exigiendo aprobación explícita.
5. Ejecutar CI y pruebas de extremo a extremo antes de fusionar con main.

## Orden de integración
- Conectar el coordinador al planificador existente mediante handlers explícitos y pruebas de permisos.
- Implementar almacenamiento cifrado por propietario/proyecto y políticas de borrado verificables.
- Ejecutar código experimental en proceso aislado, nunca directamente desde el coordinador.
- Medir la RTX 3060 con Ollama local y un conjunto fijo de casos.
