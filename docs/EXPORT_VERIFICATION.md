# Verificación de la distribución de código

Este árbol contiene código, configuración de ejemplo y pruebas. No es una copia de la instalación privada. El exportador usa una lista explícita de módulos y excluye claves, configuraciones de ejecución, historiales, bases locales, pesos Qwen/Wan, corpora, adaptadores, trabajos de agentes, capturas y paquetes instalados.

`cloud/` corresponde a Sites V12, commit `503ee94aeedd7f8cb1bdb90c6679a19ba5114b29`, con las adaptaciones de distribución documentadas. Conserva seis semillas documentales/experimentales ya publicadas y dos fuentes JavaScript de runtime (actual y legado compatible). No se ha vuelto a copiar historia privada; la semilla de continuidad conserva el identificador privado eliminado en la exportación inicial.

## Pruebas desde este árbol

- 314/314 pruebas Node aprobadas con el mismo script que ejecuta `npm test`, incluidas las de AST/aislamiento, formateador y chat, referencias oficiales y telemetría de aprendizaje. Se seleccionó el Acorn instalado del entorno opcional; no se invocó Aider ni ningún modelo.
- 49/49 pruebas cloud adicionales sobre cola SQLite real, privacidad, catálogo público, saneado de telemetría, rangos, planes, navegación, estados, geometría, música y compatibilidad de runtime.
- 4/4 pruebas Python de evolución aprobadas. Usan fixtures y comprobaciones de reserva/identidad; no cargan pesos ni entrenan en GPU.

Las dependencias de framework de la web se instalan por separado con el gestor y lockfile fijados. La comprobación del export no arrancó otro coordinador, motor Qwen ni entrenador y no repitió el build de producción ya validado en la fuente canónica.

## Integridad y saneado

Los textos UTF-8 se normalizan a LF antes de calcular hashes; `.gitattributes` conserva ese formato en Git. Los binarios se preservan. Los hashes pueden contrastarse con el contenido publicado sin diferencias por conversión de finales de línea de Windows.

El escaneo de tokens, claves privadas, correos personales, rutas de usuario e identificadores de chats privados dio cero hallazgos. También se rechazan archivos de credenciales, pesos y ejecución por nombre o extensión. Es una comprobación preventiva, no una garantía universal.

`source-export-manifest.json` registra módulos y adaptaciones; `cloud-export-manifest.json` documenta la copia web y la excepción de semillas. `github-upload-manifest.json` enumera los archivos exactos autorizados para el commit y sus SHA-256. El publicador comprueba sus hashes antes de preparar Git y contrasta la revisión remota tras el push. `node_modules/` permanece fuera de Git.

## Alcance de las evidencias de origen

La instalación de origen dispone de Aider, smolagents y el constructor nativo usando el mismo Qwen local. Su última ronda generó una herramienta de dependencias que aprobó ocho contratos y se probó con un proyecto nuevo; la candidata JSON Pointer se rechazó. El chat representa directamente el resultado verificado de dependencias sin pedir otra redacción al modelo. StrategyPolicy solo se promueve tras contratos; comparar enrutamiento no acredita capacidad general. Un entrenamiento real de adaptador Qwen9B terminó sin mejora en confirmación y no lo activó. Los resultados negativos se conservan; el repositorio no incluye esos pesos ni estados privados.

Sites V12 se comprobó en producción a 390×844: cinco herramientas públicas frente a siete aprobadas en el PC, fechas vigentes y envío manual del ejemplo desde el chat. Una consulta real de documentos oficiales y una tarea de Aider con contexto de MDN aprobaron su comprobación de ocho contratos. El export contiene el código y el resumen revisado, no la caché documental ni los trabajos del agente. El detalle está en `continuous/SITES_ACTUALIZADO_2026-11-01.md`.

La distribución comienza sin memoria, claves, modelos ni versiones activas del equipo de origen. GitHub almacena código; no proporciona su GPU, no migra historiales y no transfiere herramientas o credenciales de Codex a Atlas.
