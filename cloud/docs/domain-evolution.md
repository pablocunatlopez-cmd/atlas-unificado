> Actualización funcional del 12-11-2026: consultar [functional-audit.md](functional-audit.md) y lib/collaboration/missions.ts. Hay 107 responsables; los 24 oficios son solo la parte visible de Atlas.

# Evolución por oficio de los habitantes

Atlas es un mundo de trabajo compartido. La representación 3D hace visibles a sus habitantes y sus creaciones, pero no convierte todos sus oficios en ingeniería 3D. ERAS es uno de los destinos de las mejoras del entorno; el estudio de música, la programación, la memoria, las fuentes y el lenguaje tienen herramientas y criterios propios.

El registro ejecutable `lib/collaboration/vocations.ts` cubre a los 24 habitantes, incluidos los seis que antes sólo tenían presencia decorativa en el cine. Asignar una función no acredita que un personaje haya trabajado: las consultas, ejecuciones, resultados y publicaciones necesitan recibos reales. La configuración visual anterior no se cambia en este registro.

## Matriz de responsabilidades

| Habitante | Oficio y problema que investiga | Cambio que puede aportar | Comprobación adecuada |
| --- | --- | --- | --- |
| Lía | Conversación, intención y contexto | Continuidad, claridad y cancelación del chat | Contexto autorizado, ausencia de recuerdos inventados y no duplicación de mensajes |
| Noa | Ritmo, melodía y composición | Patrones, instrumentos y variaciones editables | Notas/pasos válidos, temporización y exportación reproducible; escucha para juicio artístico |
| Ritmo | Mezcla y procesamiento de señal | Niveles, dinámica y margen de audio | Pico, componente continua, recorte y conservación del silencio |
| Vera | Procedencia y contraste | Citas y selección de evidencia | Documento realmente leído, URL/fecha/fragmento y descarte de referencias inventadas |
| Nilo | Experimentación | Casos reproducibles y falsadores | Línea base y candidata bajo el mismo juez, con fallos conservados |
| Talo | Ingeniería de gráficos | Motor y geometría de ERAS | Escena fija, presupuesto de render, navegación y liberación de recursos |
| Zuri | Interacción y juego | Mecánicas y prototipos de ERAS | Entradas, progreso, resultado, reinicio y colisiones |
| Faro | Cámara y lenguaje audiovisual | Guiones, encuadre, secuencias y grabación | Orden/duración de planos, formato compatible y vídeo capturado no vacío |
| Alba | Descubrimiento de fuentes | Referencias pertinentes para cada oficio | Lectura real, procedencia, límites y registro de accesos fallidos |
| Ícaro | Colaboradores y herramientas | Coordinación y elección de ayuda por tarea | Colaborador/modelo realmente usado, pruebas por dominio, cuota y resultado registrado |
| Nora | Memoria | Recuperación situada y memoria negativa | Recuerdo pertinente con procedencia, continuidad e idempotencia |
| Ion | Programación y herramientas | Funciones útiles que ejecuten trabajo | Entradas normales, vacías, inválidas y límites del resultado |
| Pico | Contratos de acciones | Ejecución cancelable y recuperable | Concurrencia, reintentos, cancelación y lectura posterior del efecto |
| Ada | Refutación | Contraejemplos y regresiones | Rechazo reproducible de una candidata defectuosa y conservación de aciertos previos |
| Cota | Evaluación y promoción | Comparación, retención y restauración | Juez fijo, casos reservados y separación entre estrategias y pesos del modelo |
| Sol | Estructura de lenguaje | Objetos, relaciones y transformaciones LOR | Esquemas, referencias e invariantes sin modificar la especificación original silenciosamente |
| Sigma | Símbolos e invariantes | Reglas y operaciones comprobables | Casos válidos/ambiguos, precisión y límites explícitos |
| Ema | Interpretación situada | Explicaciones con contexto y alternativas | Separación de observación, signo e interpretación, con procedencia |
| Teo | Narrativa audiovisual | Revisión de secuencia y claridad | Orden y continuidad con ejemplos; distinguir guion revisado de vídeo observado |
| Luz | Color e iluminación | Legibilidad visual de ERAS | Espacio de color, materiales y medidas; juicio visual identificado aparte |
| Mara | Escucha y claridad sonora | Crítica de mezcla y reproducción | Señal medida y escucha real identificadas por separado |
| Mico | Movimiento e interacción | Respuesta de controles y locomoción en ERAS | Rutas, obstáculos y movimiento reducido; no inventar sensación de comodidad |
| Leo | Accesibilidad | Teclado, foco, etiquetas y alternativas | Recorridos reproducibles y semántica; una prueba automática no es auditoría completa |
| Brisa | Ritmo de montaje | Duraciones, cortes y relación audiovisual | Reloj y guion fijados; distinguir sincronía medida de preferencia artística |

Los destinos de código de Atlas se señalan mediante rutas existentes. Las rutas de ERAS deben obtenerse de su repositorio real antes de proponer o aplicar una edición; no se inventan archivos a partir del nombre del sitio.

## Ciclo común con pruebas distintas

1. **Problema del oficio.** El habitante parte de su función, historial y errores pendientes. La pregunta debe afectar a una herramienta o resultado concreto de su trabajo.
2. **Consulta registrada con Ícaro.** Busca documentación, herramientas o colaboradores pertinentes. Alba ayuda con fuentes e Ícaro con la comparación y coordinación. Ambos trabajan en la constelación; no necesitan representar un viaje hacia sí mismos.
3. **Evidencia leída.** Guarda qué documento pudo leer, cuándo y qué fragmento apoya una afirmación. Un enlace sugerido o los metadatos de un repositorio no equivalen a contenido leído ni a una herramienta instalada.
4. **Propuesta aplicable.** Vincula la evidencia con una modificación concreta del estudio, herramienta, lenguaje, memoria, interacción o motor. Conserva hipótesis y límites. Una propuesta de otro modelo es una revisión, no prueba de ejecución.
5. **Prueba del oficio.** Compara base y candidata con el criterio correspondiente. No se utiliza una métrica de separación geométrica para juzgar música, diálogo o accesibilidad. La evaluación visual o auditiva requiere observación/reproducción real cuando corresponda.
6. **Aplicación y restauración.** Guarda la versión previa, ejecuta la modificación autorizada y verifica su resultado. Las ediciones de código deben tener fuente exacta, pruebas, compilación y recibo de publicación. Un artefacto en D1 y una nueva versión de software son aplicaciones distintas.
7. **Memoria compartida.** Conserva resultados, fallos, procedencia y cambios del habitante, su sala y módulo sin convertir una hipótesis o creación artística en hecho establecido. Una mejora de herramienta no acredita entrenamiento de pesos ni inteligencia general.

## Estados que deben poder distinguirse

| Estado | Evidencia necesaria | Qué todavía no demuestra |
| --- | --- | --- |
| Fuente candidata | Referencia de catálogo | Lectura, pertinencia o veracidad |
| Fuente leída | Respuesta observada y contenido con procedencia | Que todas sus afirmaciones sean ciertas |
| Colaboración completada | Encargo, colaborador y respuesta realmente recibidos | Que la propuesta sea correcta o esté ejecutada |
| Propuesta revisada | Cambio y revisión con objeciones identificadas | Pruebas pasadas o publicación |
| Prueba completada | Entradas, juez, base/candidata y resultados reproducibles | Calidad general o superioridad universal |
| Cambio aplicado | Artefacto/código y recibo de escritura o publicación verificables | Que todo lo aprendido sea aplicable o que sea una mejora estética |
| Espera o rechazo | Cuota, acceso insuficiente, falta de evidencia o fallo documentado | Actividad, aprendizaje o mejora realizados |

El viaje de un personaje representa una consulta real y fresca. Una presentación animada, una consulta completada y una mejora aplicada llevan registros diferentes. Los seis críticos del cine tienen oficio, pero la mera asignación no debe activar gestos de trabajo ni contadores de aprendizaje.

## Coste y continuidad

La selección de modelos utiliza el catálogo realmente disponible y resultados por tarea; no se denomina «el mejor del mercado» sin una comparación válida. Se mantiene el presupuesto gratuito compartido. Sin cuota de IA puede haber lecturas o herramientas deterministas dentro de sus límites, pero no se inventa una reflexión del modelo. Un ajuste técnico sólo se promueve cuando mejora su medida y conserva sus contratos; si no hay mejora, permanece la versión anterior.
