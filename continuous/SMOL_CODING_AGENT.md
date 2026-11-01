# smolagents en Atlas

Tercer constructor, junto a Aider y el generador nativo: smolagents 1.26.0 de Hugging Face, Apache-2.0. Fuentes: https://github.com/huggingface/smolagents y https://pypi.org/project/smolagents/1.26.0/. La rueda oficial de 161.466 bytes se verificó con SHA-256 `70e1cfb1576f782da93190ee31d9bb2659e5ca4bd84fda0c412e1f20498f28b6` antes de instalarla sin actualizar dependencias.

Usa `ToolCallingAgent` y `OpenAIModel` apuntando exclusivamente al Qwen local. Esa clase describe un protocolo compatible: no conecta al proveedor OpenAI ni consume sus créditos. Solo registra `final_answer`; no habilita intérprete Python, shell, navegación, MCP ni herramientas de archivos. El adaptador escribe un único artefacto, validado después mediante AST y contratos QuickJS externos. Máximo dos pasos por edición, tres ediciones por tarea y procesos cancelables. Solo permite sockets hacia el puerto local 11435. La credencial local se pasa en memoria al entorno, sin argumentos, prompts ni resultados.

Los tres constructores usan el mismo Qwen; no son modelos independientes ni reciben credenciales o conectores de Codex. El selector conserva las métricas existentes y explora un proveedor nuevo antes de comparar aprobaciones, fallos y tiempos. Los errores de ejecución permiten volver al constructor nativo. No instala automáticamente paquetes descubiertos en repositorios ni edita el servidor.

Ensayos reales del 1 de noviembre de 2026: inferencia conectada, dos tareas con ocho contratos, ambas rechazadas tras sus reparaciones. Los fallos se conservan. No se presenta este agente como una mejora ni como el mejor. Aider mantiene dos tareas aprobadas de dos registradas en ese instante. Estas cifras no son un benchmark universal.

`createSmolCodingAgent()` utiliza el runtime opcional común de `ATLAS_CODING_AGENT_ROOT`, con archivos separados `smol-runtime-ready.json` y `smol-statistics.json`. El repositorio no contiene ese entorno, los trabajos ni las credenciales. El preflight CPU comprueba importación y configuración con sockets cerrados. `verify-coding-agent-live.mjs smolagents` ejecuta una tarea real mediante el coordinador y guarda su evidencia privada.
