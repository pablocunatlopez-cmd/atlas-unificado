# Verificación de la distribución de código

Verificación del 2 de noviembre de 2026. Este árbol contiene código, configuración de ejemplo y pruebas. Excluye claves, configuración privada, historiales, bases locales, pesos, corpora, adaptadores, trabajos de agentes, capturas y paquetes instalados.

## Publicación web comprobada

La web corresponde a Sites V17, fuente `f89a17425b72ac792be2149b9f6d9ecc6cae419a`, publicada el 2026-11-01 a las 21:05:41 UTC. La casa tiene diez salas y residentes humanos, robots, animales y aves. Sus gestos dependen de actividad reciente comunicada por el PC; las marcas de aprendizaje dependen del contador de cambios aceptados. Se comprobó el sitio publicado en escritorio y a 390×844, incluida la legibilidad de las etiquetas y el animal del laboratorio.

El chat comparte identidad e inventario de capacidades con el coordinador: reconoce la casa virtual y la adaptación de ERAS, las funciones de música y 3D, y los límites de modificación del programa. Una petición explícita de mejorarse puede encolar una revisión real. Encolarla no acredita una mejora terminada.

## Pruebas desde este árbol

- 417/417 pruebas Node del núcleo aprobadas mediante `node scripts/test-source.mjs`. Incluyen aislamiento QuickJS, contratos, cancelación, espiral, persistencia de contraejemplos, saturación de cobertura, identidad, inventario, guía curada, MCP documental, lectura directa de referencias y memoria de fuentes entre experiencias.
- La comprobación cloud de Sites V17 permanece en 71/71 pruebas aprobadas; esos módulos no cambiaron en esta entrega. Incluye rutas, cola, privacidad, saneado de telemetría, planes, navegación, geometría, habitantes y música. Sus dependencias de framework permanecen excluidas del repositorio.
- La espera de la prueba de parada asíncrona del laboratorio secundario se corrigió para comprobar el estado terminal durante un plazo explícito. No cambió el comportamiento de producción.

Las pruebas de distribución no iniciaron otro coordinador, modelo ni entrenamiento GPU. Las dependencias del framework web se instalan por separado según su lockfile.

## Operación comprobada y límites

La instalación de origen se reinició con el mecanismo habitual y respondió con Qwen saludable, experiencia habilitada y sin pausa. Se comprobó que la guía aparece por identificador, fecha y SHA-256 en una experiencia real. El 2 de noviembre se verificó también la memoria cargada y su presencia en las observaciones del planificador. La revisión no depende de mantener abierto Codex, pero sí de que el PC y sus servicios sigan disponibles.

La recuperación puede leer direcciones de la guía curada cuando fallan los buscadores. Una prueba real recuperó documentación de Three.js, la guardó y la volvió a encontrar sin llamar al modelo. Las consultas conservan causa medida y fecha de reintento; cuando no hubo lectura nueva no solicitan otra reflexión de Qwen. La memoria de fuentes permanece local, acotada y fuera de GitHub. Los fragmentos recordados siguen siendo datos no verificados y no incrementan los cambios aceptados. Ver `continuous/RECUPERACION_EVIDENCIA_2026-11-02.md`.

La guía enlaza referencias públicas de Aider, smolagents, llama.cpp, lm-evaluation-harness, EvalPlus, Three.js, Khronos y MIT. Distingue adaptadores existentes de referencias pendientes de integrar. Atlas conserva la elección de objetivos. El límite de cobertura deja de ofrecer la misma fuente tras tres lotes completos sin contradicción; variar semillas o UUID no lo evita. Una fuente cambiada o un contraejemplo ejecutado y verificado puede abrir nueva cobertura. El historial rotatorio no elimina esos testigos. Saturación no significa corrección universal.

Aider, smolagents y el constructor nativo comparten el mismo Qwen. El MCP público de OpenAI Docs se conectó realmente: cinco herramientas descubiertas y un adaptador de búsqueda de lectura. No es otro modelo y no transfiere los conectores protegidos de Codex. El adaptador envía vocabulario público de temas, no el prompt privado.

La reparación de JSON Pointer aportó un cambio aceptado en la espiral; cientos de experiencias no equivalen a cientos de mejoras. No hay evidencia de un adaptador LoRA activo ni de mejora general de los pesos. Los prototipos 3D tienen contratos geométricos y requieren valoración visual; no se afirma calidad AAA. La modificación autónoma sigue limitada a herramientas y políticas verificadas, sin edición arbitraria del servidor.

## Integridad y saneado

Los textos UTF-8 se normalizan a LF antes de calcular hashes; `.gitattributes` conserva ese formato en Git. Los binarios se preservan. El escaneo de tokens, claves privadas, correos personales, rutas de usuario y enlaces a chats privados dio cero hallazgos. Es una comprobación preventiva, no una garantía universal.

`source-export-manifest.json` registra módulos y adaptaciones. `cloud-export-manifest.json` documenta la copia web y las semillas saneadas conservadas. `github-upload-manifest.json` enumera los archivos exactos autorizados y sus SHA-256. El publicador verifica esos hashes antes del commit y contrasta la revisión remota tras el push.

La distribución comienza sin memoria, claves, modelos ni versiones activas del equipo de origen. GitHub almacena código; la inferencia publicada continúa usando el PC mediante el puente saliente.
