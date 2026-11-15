# Verificación de la distribución de código

Verificación del 2 de noviembre de 2026. Este árbol contiene código, configuración de ejemplo y pruebas. Excluye claves, configuración privada, historiales, bases locales, pesos, corpora, adaptadores, trabajos de agentes, capturas y paquetes instalados.

## Publicación web comprobada

La web corresponde a Sites V21, fuente `f2751ba7b7a0920809fb4c5223a7232f577b921c`, publicada el 2026-11-02 a las 20:26:54 UTC. La casa tiene diez salas y 24 residentes: 18 puestos y 6 espectadores. Sus gestos y las etiquetas de actividad comparten el filtro de proceso, fase y señal reciente comunicada por el PC; las marcas de aprendizaje dependen del contador de cambios aceptados. La revisión V21 verificó a 435×528 que al visitar un puesto el panel se pliega y deja visible el rostro, y que los detalles muestran el contador real y el plan vivo. El selector permite visitar cada puesto.

Los planes 3D válidos de experiencias reales llegan ahora a la escena y sustituyen la geometría de dos espacios reservados: maqueta del taller y terraza. La publicación real recibió el plan vivo de ocho objetos frente a los cuatro del estado inicial retenido. Los seis contratos son geométricos: no acreditan una mejora estética ni entrenamiento de Qwen, y no autorizan reescribir toda la casa. Ver `continuous/CASA_VIVA_2026-11-02.md`.

El chat comparte identidad e inventario de capacidades con el coordinador: reconoce la casa virtual y la adaptación de ERAS, las funciones de música y 3D, y los límites de modificación del programa. Una petición explícita de mejorarse puede encolar una revisión real. Encolarla no acredita una mejora terminada.

## Pruebas desde este árbol

- Tras corregir la limpieza de procesos, la ejecución completa terminó con 498 casos: 491 aprobados, cero fallos y siete omitidos por la dependencia opcional Acorn del adaptador Aider. Esos siete se ejecutaron aparte usando el runtime aislado instalado en el PC y pasaron 7/7. Incluye 15 pruebas de creación/memoria geométrica y 10 de procesos del laboratorio. El verificador de memoria viva revalidó un diseño real sin inferencia y confirmó el estado intacto mediante SHA-256.
- La comprobación cloud de Sites V21 pasó 93/93 pruebas, junto con TypeScript y el build de producción. Incluye rutas, cola, privacidad, saneado de telemetría, planes, navegación, geometría, habitantes, instalación creativa y música. Sus dependencias de framework permanecen excluidas del repositorio.
- La espera de la prueba de parada asíncrona del laboratorio secundario se corrigió para comprobar el estado terminal durante un plazo explícito. No cambió el comportamiento de producción.

La cancelación de procesos sí recibió una corrección de producción en esta entrega: termina su hijo propio si falla el cierre del árbol, espera su salida durante un plazo limitado y libera las tuberías. No actúa sobre un PID cuya raíz ya haya salido ni afirma haber verificado el cierre de todo el árbol. La prueba completa tiene además un límite de 60 segundos por archivo para evitar esperas indefinidas.

La memoria incremental y esta corrección del backend están preparadas en código y probadas; requieren cargar los módulos actualizados en el coordinador. La espiral que ya estaba activa se conservó durante la entrega.

El reinicio dispone de `-CheckOnly`: comprueba identidad local y accesos al puente y al mutex antes de enviar la parada. En el entorno restringido detectó el rechazo CIM antes de parar; el coordinador existente siguió saludable. La publicación de Sites está terminada. La subida nueva de GitHub y el cambio de visibilidad siguen pendientes porque el usuario pospuso completar su autenticación.

Las pruebas de distribución no iniciaron otro coordinador, modelo ni entrenamiento GPU. Las dependencias del framework web se instalan por separado según su lockfile.

## Composición y reparación

La composición admite hasta tres funciones aisladas. Las peticiones explícitas con un solo JSON se dirigen sin inferencia cuando el contrato es inequívoco; el resto conserva el planificador Qwen. Tres comprobaciones reales del chat compartido local pasaron con resultados exactos y cero llamadas al modelo.

La reparación conserva la implementación con mejores resultados medidos y sus contraejemplos. Un fallo de confirmación puede alimentar automáticamente hasta tres rondas, sin pedir otro turno al usuario. Se evita otra reescritura verbal antes de la ejecución física del código. Nuevos contratos CSV y JSON Patch no se presentan como herramientas aprobadas hasta superar sus comprobaciones. Sus ensayos negativos se conservan sin activar.

Ver `continuous/CAPACIDADES_Y_COMPOSICION_2026-11-02.md`.

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
