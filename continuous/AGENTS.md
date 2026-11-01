# Atlas: una carpeta canónica


- Chat local: http://127.0.0.1:8788/chat/ . Panel común: /project/ . Un solo coordinador Node y una instancia llama.cpp sirven Qwen en GPU.
- `components/atlas597` contiene los módulos, modelos y evidencias del segundo proyecto Python. La copia de Descargas y sus datos originales quedan conservados como archivo y dependencia de Python. No crear otra copia activa ni arrancar su servidor antiguo.
- Modificar los componentes aquí. Preservar el manifiesto de origen; los cambios posteriores deben documentarse como adaptaciones, sin fingir que coinciden con el hash original.
- `secondary-atlas.mjs` expone acciones fijas y procesos acotados. El laboratorio usa CPU y dos hilos. Sus candidatos no sustituyen Qwen automáticamente. El clasificador de decisiones y los prototipos por reglas no acreditan un modelo general ni calidad AAA.
- El supervisor respeta `data/service.stop`. Reiniciar con `Restart-Atlas.ps1`; abrir la ventana con `Start-Atlas-Desktop.ps1`. No imprimir claves ni tokens.
- La investigación y la revisión autónoma de extensiones son procesos locales; los reflejos y la recuperación de documentos no entrenan pesos de Qwen.
- El chat de Codex sigue siendo Codex. Nunca atribuir sus respuestas a Atlas/Qwen sin una consulta local real. El usuario puede conversar directamente con Atlas en su ventana sin créditos de Codex.
- Prioridad vigente del usuario: autonomía y mejora comprobable antes que ampliar el 3D. Aider 0.86.2 y el generador nativo están disponibles para el ciclo autónomo, con selección por resultados de contratos y exploración acotada. Ambos usan el mismo Qwen; no son modelos independientes y no requieren OpenRouter ni activar una mesa en cada turno.
- El núcleo de políticas DSL admite cambios comprobados y reversibles: generación activa 1, de 8/9 a 9/9 contratos. La herramienta estructural LOR-ΩΣ fue creada por Qwen y aprobó 8/8 contratos externos; conserva O,A,X,R,T,I,C,E,M,P,F,Σ. Esto no acredita una teoría física ni una mejora general del modelo.
- El entrenamiento real de Qwen9B produjo un candidato LoRA de 4,19 millones de parámetros entrenables en ocho pasos, con exportación GGUF real. La evaluación quedó en 4/8 → 4/8, sin mejora: el adaptador no está activo. El ciclo autónomo prepara candidatos a partir de herramientas verificadas, con un mínimo de seis horas entre ensayos y solo si hay nuevos datos; el chat tiene prioridad. No confundir esta vía con el MLP experimental ni marcar ensayos como pesos activos.
- No hay edición arbitraria autónoma del servidor ni instalación automática de extensiones de VS Code. Las herramientas generadas se ejecutan como funciones puras aisladas en QuickJS.

Leer `ATLAS_MANDATO_UNIFICADO.md`, `VERIFICACION_UNIFICACION_2026-10-31.md` y `VERIFICACION_AUTONOMIA_2026-11-01.md` para los límites, requisitos y pruebas del proyecto integrado.

La web compartible está publicada en https://atlas-personal.pablo-cunatlopez.chatgpt.site/ (proyecto Sites appgprj_6acdbbc1ce80819192cfb514a4cd474f): V11, commit 38849b3e8b063af91eeeeaff5c054b641128e14f, casa de diez salas. Su código está en cloud/ y el repositorio privado creado es https://github.com/pablocunatlopez-cmd/atlas-unificado. Leer CLOUD_ACCESS.md antes de cambiar el acceso remoto. La inferencia sigue en este PC mediante el puente saliente; las sesiones compartidas excluyen memoria y controles privados y solo reciben las funciones públicas canónicas ejecutadas en QuickJS. No subir data/*.key, historiales ni configuraciones personales al repositorio de código.

smolagents 1.26.0 es otro constructor gratuito conectado al mismo Qwen. Sus dos primeros ensayos fallaron y no se promovieron. La selección usa resultados reales, no el nombre del framework. Los agentes y conectores de Codex no están transferidos a Atlas. Ver SMOL_CODING_AGENT.md.

El empujón autónomo del 1 de noviembre se documenta en EMPUJON_AUTONOMO_2026-11-01.md. El currículo incluye JSON Pointer y planificación DAG con contratos externos; la política conserva refutaciones de desarrollo sin filtrar el lote reservado. Con tareas elegibles, la próxima ronda se programa en cinco minutos; los fallos mantienen su cooldown. Consultar /process/status y /capabilities/status para estado vigente, en lugar de tratar cifras históricas de este documento como contadores actuales.
