# Atlas frente a agentes autónomos de código abierto (2026)

## Referentes verificados
- OpenHands: https://github.com/OpenHands/OpenHands — separación entre interfaz, servidor de agentes, sandbox y automatización.
- Aider: https://github.com/Aider-AI/aider — mapa del repositorio, Git, lint y pruebas.
- Letta: https://github.com/letta-ai/letta — memoria de trabajo y archivo persistente.
- SWE-agent: https://github.com/SWE-agent/SWE-agent — herramientas acotadas, trayectorias y evaluación de incidencias.
- Microsoft Agent Framework: https://github.com/microsoft/agent-framework — coordinación de agentes. No incorporar el AutoGen archivado como dependencia nueva.

## Decisiones para Atlas

| Prioridad | Inspiración | Implementación propuesta | Evidencia necesaria |
|---|---|---|---|
| P0 | OpenHands | ejecución aislada con directorio de trabajo y permisos mínimos | pruebas de escape y denegación de acceso |
| P0 | Aider | cada cambio en rama, pruebas, diff y rollback | CI verde y restauración probada |
| P0 | SWE-agent | presupuesto de pasos, tiempo y herramientas por tarea | límites probados ante bucles |
| P1 | Letta | memoria episódica y semántica con ámbito por usuario/proyecto | pruebas de aislamiento y borrado |
| P1 | Agent Framework | coordinador con roles y decisiones auditables | trazas y pruebas de recuperación |
| P1 | DSPy | selección por benchmarks reproducibles | mediciones reales con GPU |
| P2 | OpenHands | panel remoto de tareas y permisos | pruebas extremo a extremo |

## Implementado en esta rama
- `continuous/model-promotion-plan.mjs`: plan sin efectos secundarios que requiere candidato recomendado, revisiones SHA-1 explícitas y aprobación humana.
- `continuous/model-promotion-plan.test.mjs`: casos de autorización, selección y validación de revisiones.
- Evaluación emparejada y clasificación de modelos con pruebas deterministas; adaptador local Ollama.

## Lo que NO se ha implementado
- No hay despliegue automático ni sustitución del modelo en ejecución.
- El plan no verifica por sí mismo que los hashes correspondan a commits existentes; el ejecutor futuro debe hacerlo.
- No hay sandbox nuevo ni memoria Letta integrada.
- No se han ejecutado benchmarks de la RTX 3060 desde GitHub.
- El benchmark no-streaming no mide TTFT real; registra un límite superior, no una medición.

## Criterios para avanzar
1. CI debe pasar en una instalación limpia.
2. Revisión de autenticación del puente y ejecución en sandbox.
3. Pruebas de aislamiento de memoria por usuario/proyecto.
4. Medir Qwen actual frente a un candidato en el mismo hardware, con tareas verificadas externamente.
5. Activación solo con aprobación explícita y rollback comprobado.
