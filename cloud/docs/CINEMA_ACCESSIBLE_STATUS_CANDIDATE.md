# Cine: candidata de estado accesible — 22-11-2026

Estado inicial conservado: candidata local completa, NO publicada en el intento 89. La integración posterior se documenta al final. Base Atlas v65, commit 38c9cfc3933400f7718e0adc5d3cacd18df13d5f. ERAS permanece v13, 43ea8968dc66c453da9c29d1ca469c91e177a2bc. Ambos Sites siguen privados del propietario. GitHub main sigue en 86b08002ed57a806d3a270f362a326f3ae694dd3; no se modifica esa línea ni PR1.

Encargo abierto work-553c6de8-7e6c-48e5-a016-01f56b25c8fe, responsable canónico resident:cinema-audience-5 (Leo). Mejora útil para el entorno de Lía: comunicar las transiciones del instrumento de cine mediante semántica accesible, conservando grabación explícita, errores separados, controles e integración de la pantalla con la casa real.

## Defecto e intervención

CinemaPanel montaba el párrafo de estado sólo al recibir texto y carecía de role=status. El progreso opcional de descarga no tenía nombre accesible. La candidata mantiene desde el primer render un párrafo vacío con role=status, aria-live=polite y aria-atomic=true, y etiqueta el progress. No mueve foco ni altera los atributos anteriores de música/biblioteca. No añade generación GPU ni cambia el motor.

## Evidencia leída y rechazo conservado

Consulta adicional única de esta vuelta: icarus-89, engineering:cinema-accessible-status-20261122. MDN status_role (source-cac14019f7f2af843a4081b3) explica semántica polite/atomic y no mover foco; MDN progress (source-d83b60205f3c2614ecc4592f) documenta el indicador y su etiquetado. URLs:

- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/progress

GPT-OSS120B completó propuesta; Qwen completó revisión y la rechazó porque su validación exigía NVDA/VoiceOver. Esa ejecución no existe aquí. El encargo enviado ya pedía simulación sin afirmar auditoría real; el proponente añadió una condición que no se cumplió. No se borra ni se convierte ese rechazo en recibo. No se hace otra consulta específica esta vuelta. Pendiente: nueva propuesta que resuelva expresamente esa objeción con alcance verificable, o revisión real asistiva cuando exista entorno. Esta candidata no acredita anuncios efectivamente escuchados, foco de navegador ni cumplimiento global de accesibilidad.

## Programas realmente ejecutados

- tests/atlas-cinema-status.test.mjs transpila y ejecuta el componente real con hooks y API de captura simulados: región inicial vacía, transición pendiente/completada, botón deshabilitado, descarga del clip, error separado y nombre/valor del progreso. Las dos pruebas fallaron contra la base por ausencia de región persistente. El harness necesitó compartir Error entre contextos VM, esperar la cola de promesas y corregir el índice de VideoState; fueron errores del simulador, no defectos nuevos del producto.
- 14/14 pruebas pasan al combinar ese archivo con tests/atlas-functional-cinema.test.mjs, lib/house/realism.test.mjs y lib/house/house-quest.test.mjs. Conservan pantalla funcional, armarios, Ion, superficies PBR y prototipo de cuatro acciones.
- TypeScript --noEmit --incremental false: correcto.
- collaboration-evidence.mjs --check: correcto, sin ampliar inventario privado.
- build-site.mjs: compilación completa correcta.

La vuelta normal scheduled:2026-11-22T05 produjo 00f3afba-2b15-43d6-80b5-ca163135886b / icarus-88 (process:suceso), rechazada por suponer un endpoint sin evidencia de repositorio. Se leyeron sus extractos de Fetch y límites GitHub, sin implementar esa propuesta. No hubo otra vuelta, verify, calificación, pulso foreground ni cambio de agenda/cuota/proveedor.

Sin publicación: no se envían record ni record-engineering; la cola de Leo permanece abierta y se conserva v65. No hay entrenamiento de pesos ni aprendizaje acreditado por esta candidata.


## Reanudación: revisión icarus-90

El nuevo intento engineering:cinema-accessible-status-review-scope-20261122 resuelve expresamente la objeción de 89. GPT-OSS120B y Qwen completaron sus respuestas; Qwen admitió el alcance CPU. El primer envío superó los 600 caracteres del contrato y devolvió HTTP 400 antes de consulta; se corrigió la longitud y se reutilizó el mismo requestId. No hubo llamadas adicionales por ese error de entrada.

El ejecutor conserva criterio propio: no envuelve el progress opcional con otro status, porque el estado principal necesita existir desde el primer render y no conviene duplicar regiones. Se aplica la candidata identificada, no una garantía del modelo. No se acredita React Testing Library (no instalado), navegación Tab/Shift+Tab ni anuncios NVDA/VoiceOver. Se ejecuta el componente TSX real mediante el harness CPU documentado y se inspeccionan los atributos; esas herramientas no sustituyen una auditoría asistiva. Los casos de progress incluyen 0, 25 y 100 sobre max 100. La revisión textual no demuestra ejecución ni garantiza percepción de todos los usuarios.

Apertura nativa de Atlas confirmó la base 38c9cfc sin trabajo ajeno; GitHub main sigue 86b0800. La hora UTC inicial coincide con la vuelta scheduled:2026-11-22T05 ya registrada; no se repite ni se cambia su ID al cruzar la hora. No hay nuevos personajes, cambios de catálogo ni de motor: el encargo corresponde al responsable existente Leo. Rechazos 88 y 89 conservados.

Integración preparada para publicar sólo tras controles de tipos, regresiones y compilación del commit subido. El recibo autenticado posterior debe contener el SHA y versión realmente devueltos por Sites; no acredita observación GPU ni entrenamiento de pesos.
