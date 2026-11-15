# Coordinación actual por oficios

La agenda principal consulta a Ícaro para un habitante de la rotación de 24 oficios. Usa documentación apropiada a esa especialidad y conserva fuentes, propuestas, pruebas y publicaciones como estados distintos. El constructor 3D permanece disponible para encargos de escenas, sin ser el destino universal del trabajo.

Ion puede ejecutar además el laboratorio de programas numéricos en su turno y Cota comparar estrategias en el suyo, si sus evaluaciones están pendientes y queda presupuesto. Las secciones históricas siguientes describen componentes conservados; no sustituyen la rotación actual ni autorizan a contabilizar una lectura como cambio publicado.

El flujo de ingeniería de la tarea de nube debe inspeccionar el repositorio elegido, implementar, probar y publicar mediante Sites antes de comunicar el recibo de aplicación en `/api/icarus`. El Worker no contiene credenciales de Git ni de publicación. Las vocaciones orientan la misión; una consulta puede identificar expresamente Atlas o ERAS como destino sin cambiar el oficio del personaje.

Véanse `domain-evolution.md` y `project-analysis.md` para responsabilidades, criterios y limitaciones. La memoria histórica y los programas instalados se conservan.

---

# Atlas: investigación pública y mejora acotada

## Espirales de capacidades · 11-11-2026

La vista `/espiral` conserva cuatro espirales interiores: gráficos, programación, audio y percepción. Cada vuelta usa un ID de petición único, conserva el padre, la profundidad, la duda siguiente y las incertidumbres de su rama. La rotación equitativa impide que una rama monopolice la agenda. Un fallo de inferencia conserva su pregunta y marca espera; las otras ramas siguen teniendo turno. La profundidad es historia metodológica, no una medida de inteligencia.

Dentro de cada módulo, otra rotación recorre los 24 habitantes reales del roster 3D (incluidos los seis espectadores, que reciben roles de revisión, sin fingir nuevos procesos locales). Los nombres, salas y funciones provienen de `residents.js` y `layout.js`; la personalidad es un rol estable declarado en `world.ts`. Cada habitante, cada una de las diez salas y cada uno de los cuatro módulos tienen memoria separada: intentos, reflexiones completadas, fuentes, pregunta, incertidumbres y último recibo. Una vuelta actualiza solo al habitante elegido, su sala y su módulo. Los ajustes aprobados se atribuyen al módulo, no a una inteligencia individual inventada. La interfaz 3D muestra esa memoria al visitar una sala o personaje, separada de los gestos y la telemetría del PC. La inferencia es el mismo Qwen ya configurado, con contexto público específico del rol; no se crean 24 modelos ni conciencia.

El worker realiza trabajo acotado cuando recibe una petición. No existe un proceso infinito en memoria: la tarea vinculada lo despierta cada hora, incluso con Sites cerrado. Se conserva la pausa, el arrendamiento, el control de revisión y la idempotencia existentes. Los límites de Groq y el presupuesto de 60 inferencias diarias siguen vigentes; no hay cambio de proveedor, plan ni facturación. Cada vuelta puede consumir dos inferencias; la cuota se comparte con el chat.

Además de documentación primaria y búsquedas públicas, cada rama ejecuta una prueba técnica fija. Gráficos puede promover filas 12 → 18 → 24 por esfera si reduce el error radial de la geometría real y respeta 2.000 triángulos por esfera. Los nuevos proyectos del Studio y del chat consumen el perfil aprobado; no se reescriben los proyectos existentes. La prueba de CPU no mide FPS ni estética. Audio puede activar eliminación de DC y atenuación de picos con ganancia estéreo compartida para nuevas exportaciones WAV; se conserva el silencio, la relación entre canales y un pico máximo de 0,94. No es un generador de voz ni un modelo musical.

Programación comprueba la misma función aritmética emitida por el compilador (incluyendo entradas vacías, operación desconocida, división por cero y desbordamiento). Percepción comprueba estadísticas de píxeles y audio. Repetir un candidato ya evaluado no acredita progreso técnico nuevo. Cada informe guarda sus controles, métrica, alcance y perfil anterior para recuperación; las fuentes y registros anteriores permanecen en D1. Los ajustes son perfiles de código ya publicado: la espiral no ejecuta parches arbitrarios ni cambia el juez o los pesos.

El analizador de la interfaz acepta archivos escogidos por el usuario (hasta 8 MB; audio hasta dos minutos; imágenes reducidas a 512 píxeles de lado). Calcula luminancia, contraste, bordes, RMS, DC y picos localmente. No pide cámara ni micrófono, no sube los archivos y no los incorpora a búsquedas ni a Qwen. No afirma reconocimiento semántico.

Verificación reproducible: `node --experimental-strip-types --test tests/atlas-evolution.test.mts` junto a las regresiones de núcleo, investigación, Studio, runtime raster, cola de nube y música. Los tests usan señales sintéticas; no demuestran mejora general ni garantizan avance ilimitado en los próximos días.

Proyecto: `appgprj_6acdbbc1ce80819192cfb514a4cd474f`.
Se preserva acceso exclusivo del propietario. No ampliar audiencia sin sustituir la autorización del actualizador compartido.

## Qué ejecuta

Atlas consulta Wikipedia en español e inglés, Crossref y, en temas técnicos, metadatos de repositorios públicos de GitHub. El lector HTTPS admite el catálogo exacto de `lib/research/web.ts`; no es un navegador de cualquier dominio, no interpreta JavaScript de páginas y no lee PDF. Los fallos de proveedores se conservan, y los otros proveedores pueden continuar. La extracción pública no necesita claves. La deliberación usa el secreto GROQ_API_KEY configurado en Sites y Qwen en Groq; no consulta el PC.

Cada ejecución de agenda lee hasta tres extractos nuevos. Recorre programación, render, evaluación, modelo propio, evidencia, ciencia, ecología y semiosis; intercala una pregunta de contraste generada por una regla fija a partir del título de una fuente nueva. Sin inferencia se conserva el ciclo histórico de reglas. Con GROQ_API_KEY, Qwen elige la pregunta usando dudas pendientes y reflexiones previas; el resultado se registra con motivo, conclusión, incertidumbres e IDs de fuentes y la próxima pregunta alimenta la siguiente vuelta. Una consulta manual no desplaza la agenda. Solo los registros con deliberation.status=completed acreditan una respuesta real del modelo. Una reflexión sigue siendo hipótesis no validada. La conversación Q histórica sigue siendo una instantánea separada.

El historial guarda URL, fecha de consulta, clase de evidencia, extracto y SHA-256. Una consulta no actualiza la fecha de publicación. Metadatos de repositorio o referencia bibliográfica no se incorporan como evidencia del contenido. Texto repetido, aunque cambien título o URL, no cuenta como fuente nueva. Una modificación de texto conserva la versión previa. Una fuente guardada puede recuperarse por el chat; no se transforma en hecho validado.

El perfil candidato `focused` añade una bonificación por frase exacta en el título. La selección usa tres casos de desarrollo. La prueba separada contiene seis casos sintéticos de orden de palabras, conservación de una recuperación simple y abstención. Se exige mejora, ninguna pérdida de un caso previamente aprobado y los siete controles del núcleo. No es una evaluación de comprensión, verdad, programación general o competencia con otros modelos. La versión/huella del juez queda registrada una vez; las siguientes ejecuciones no vuelven a usar ese mismo juez como progreso. Restaurar el perfil base conserva el juez utilizado para impedir repromoción inmediata. No hay edición automática de código ni entrenamiento neuronal en este ciclo.

La base D1 separa control, ejecuciones y versiones de fuentes. El arrendamiento temporal impide ejecutar dos ciclos a la vez; una revisión optimista y un batch atómico impiden que un proceso antiguo guarde por encima de una pausa/cambio posterior. El request ID único permite reintentar la misma llamada sin duplicarla. No se borran ejecuciones ni fuentes al llenar una pantalla; las vistas cargan las últimas 18, y el chat consulta un conjunto acotado de 120 versiones. La exportación desde la interfaz contiene solo los registros visibles, no la base completa.

## Ejecución sin navegador

El endpoint `GET /api/autonomy` devuelve estado, historial reciente y el contrato de actualización. `POST /api/autonomy` con `{"action":"run","trigger":"schedule","requestId":"scheduled:<UTC YYYY-MM-DDTHH>"}` ejecuta un ciclo de la agenda guardada. No se envían consulta, URL, historial o memoria privada desde la tarea. `enabled:false` devuelve una pausa sin ejecutar un ciclo. El endpoint funciona mientras la web está cerrada.

La tarea vinculada obtiene el Site mediante Sites `get_site`, verifica que sigue siendo exclusivamente del propietario y usa su `current_live_url`. Si Sites proporciona `siwc_bypass_bearer_token`, envía `OAI-Sites-Authorization: Bearer <token>` solo a ese origen. El token va en memoria/stdin: nunca en argumentos de shell, archivos, salida ni instrucciones guardadas. La autorización de servicio la valida y consume Sites dispatch; no representa a un visitante. Sin acceso soportado, registrar el bloqueo y no cambiar el acceso de la web.

Verificar primero GET, ejecutar un único POST con ID estable por hora UTC y releer GET para encontrar el mismo `run.id`. Reutilizar el ID ante una respuesta incierta, consultar antes de reintentar y no producir un segundo ciclo. Ante BUSY, conservar el intento existente. Una pausa puede invalidar un ciclo en vuelo, sin sobrescribir el estado nuevo. No volver a publicar en las ejecuciones habituales, no avanzar Q y no enviar mensajes a terceros.

`schedule-linked` registra el ID y horario que Sites devolvió al crear una tarea; es metadato del enlace, no autorización para ejecutar trabajo distinto. Los cambios de frecuencia deben usar el control nativo de la tarea; el botón de pausa de Atlas detiene el motor aunque la tarea vinculada siga despertando.

## Comprobación

`node --experimental-strip-types --test tests/atlas-core.test.mts tests/atlas-spiral.test.mts tests/atlas-studio.test.mts tests/atlas-research.test.mts`

Las pruebas cubren destinos/redirecciones, límites de descarga, extracción inerte, fallo parcial de buscadores, selección y regresión, deduplicación y versiones, preguntas de contraste, chat y SQL real SQLite con exclusión mutua, revisión y reintentos. La lectura web y el writer de producción se prueban además con sus transportes reales. Los tests de red simulados no prueban disponibilidad del proveedor en producción.

Fuentes de implementación: documentación primaria de [MediaWiki Search](https://www.mediawiki.org/wiki/API:Search), [TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts), [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/), [GitHub Search](https://docs.github.com/en/rest/search/search) y [Workers Fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/).

## Entrenador de estrategias medido

Cada ocho horas, una vuelta de la agenda sustituye la investigación documental por una comparación de dos estrategias de respuesta del mismo Qwen. Evalúa ocho casos sintéticos: cálculo, trazado estático de JavaScript, uso de evidencia y preferencias ficticias dentro del contexto. No ejecuta código generado ni usa historiales privados. Los valores esperados los calcula un juez determinista y no se envían al modelo. Desarrollo y casos reservados son distintos; una promoción requiere mejora en ambos, sin perder ningún acierto previo. Empates, regresiones y respuestas inválidas conservan la estrategia activa. No se considera una prueba de inteligencia general, programación general ni comparación con ChatGPT.

El resultado, los casos acertados, los límites y el perfil anterior se conservan en `control.coaching` y `run.coachingTrial`. Solo una promoción cambia las instrucciones de trabajo que se añaden al chat y a la elección de preguntas; no cambia código ni pesos. La siguiente investigación recibe el dominio con más fallos como orientación, sin abandonar la función de la sala. Cuando se agota la cuota o falla la API, queda pendiente y no se registra mejora; no se intenta otra evaluación durante una hora. Una evaluación completa no se repite durante ocho horas. Se mantienen los límites de 60 llamadas por día, el proveedor y el plan configurados.

En las tareas de comprobación, un `coachingTrial.status=completed` prueba la evaluación. Un `deliberation.status=completed` prueba una reflexión documental. Ninguno equivale por sí mismo a una mejora: para el entrenador debe constar `decision=promoted`.

## Uso intensivo con cuota compartida

La agenda se conserva por horas. El entrenador puede comparar estrategias cada ocho horas en lugar de cada 24, usando las mismas dos llamadas que sustituye en esa vuelta. El presupuesto global sigue en 60 llamadas/día UTC; investigación y entrenador dejan de reservar al alcanzar 48 llamadas compartidas, dejando capacidad para hasta doce llamadas adicionales del chat. Un bloqueo de Groq se respeta igualmente. Estos límites no modifican el plan comercial del proveedor.

La herramienta `atlas-arithmetic-1` resuelve operaciones numéricas explícitas del chat sin usar inferencia ni búsquedas. Implementa precedencia, paréntesis y exponentes acotados con un parser, sin eval ni ejecución de código. Rechaza entradas ejecutables, división por cero, expresiones largas y enteros fuera de precisión segura. Sus respuestas se guardan como `atlas-tools` y no se atribuyen a Qwen. No interpreta problemas verbales ni sustituye razonamiento general. La ruta privada de solo lectura `/api/cloud/calculate?expression=...` permite verificar el mismo motor. No mejora ni altera artificialmente las notas del entrenador de Qwen.

## Catálogo de agentes de nube

`GET /api/cloud/agents` expone las calificaciones persistidas, sus fechas y sus límites. `POST` con `{action:"qualify"}` evalúa solo los tres modelos autorizados, una vez por semana como máximo por modelo (o tras una hora si falló). Usa casos sintéticos comunes y el juez determinista existente. La calificación exige >=6/8 y todos los casos de evidencia y memoria, no una afirmación de perfección. Un arrendamiento por modelo impide duplicar su prueba en solicitudes concurrentes. Las llamadas cuentan dentro de las 48 de trabajo automático y las 60 totales; un bloqueo de cuota detiene la secuencia.

`POST` con `{action:"verify"}` comprueba con un encargo de código ficticio el mismo coordinador que usa el chat. Es una prueba acotada de colaboración, no ejecuta el código propuesto y no se llama en las vueltas ordinarias. La traza distingue especialista, revisor, modelo y estado real. Otro modelo no es un juez infalible ni asegura independencia estadística. Las fuentes nuevas que un revisor trate de inventar se rechazan si no están en el contexto o borrador.

La investigación elige el modelo de contraste desde el catálogo calificado y conserva plannerModel/model en deliberation cuando corresponda. No necesita una tercera llamada por vuelta. No se cambia automáticamente el proveedor ni se incorporan modelos fuera del catálogo. La audiencia debe seguir siendo exclusiva del propietario para mantener este contrato de servicio.

El revisor de una tarea solo se selecciona si acertó los dos casos de su dominio en la calificación. Un modelo con fallos conocidos de razonamiento no revisa esa área, aunque se encuentre calificado para otras tareas.

Las reflexiones sin afirmaciones citadas conservan el borrador como unverifiedHypothesis, separado de la conclusión aceptada. Su conclusión visible es abstención; el chat y los planificadores reciben un resumen sin ese borrador no respaldado, también al recuperar registros antiguos. Una cita válida prueba trazabilidad de la referencia, no su veracidad ni implicación lógica.

## Ejecución de herramientas de programación

Atlas ejecuta cinco funciones propias sobre datos JSON: sort, dedupe, stats, counts e intervals. Cada operación comprueba tres contratos fijos antes de procesar el encargo, devuelve su resultado y el código exacto ejecutado. Son implementaciones confiables de la biblioteca, no código arbitrario generado por el modelo. Se limitan a 128 elementos y 8.000 caracteres de entrada/salida, sin red, ficheros o inferencia. Los números tienen precisión limitada. Ejemplos del chat: «Ordena [9,1,4]», «Deduplica [1,1,2]», «Estadísticas de [1,2,3]», «Cuenta frecuencias [1,1,2]», «Fusiona intervalos [[1,3],[2,5]]».

GET /api/cloud/program publica el catálogo y las 15 comprobaciones. POST recibe {operation,input} detrás del mismo acceso privado y control de origen que los otros endpoints de servicio. No guarda datos por sí mismo. En el chat el resultado se conserva como atlas-tools, con metadatos execution filtrados y sin atribuirlo a Qwen o GPT-OSS. La espiral de programación comprueba la biblioteca como fase separada; no cambia el juez existente ni cuenta repetir contratos como mejora.

Antes de guardar o mostrar extractos de búsqueda al modelo, se eliminan metadatos y resultados con coincidencia léxica insuficiente en título/texto. La selección y descartes quedan en sourceSelection. Es un filtro heurístico con términos ES/EN limitados, no prueba de relevancia semántica ni verdad; una URL pedida explícitamente conserva su tratamiento específico. Los historiales anteriores no se borran.


## Laboratorio de programas generados · 12-11-2026

La agenda incluye proyectos de programación, a lo sumo una propuesta cada cuatro horas en lugar de una vuelta ordinaria. El entrenador mantiene sus ocho horas y precedencia; no cambia la frecuencia de la tarea. Si faltan dos llamadas de fondo o existe cooldown, no se inicia síntesis y continúa el laboratorio espacial existente. No hay bucles de reparación para gastar cuota.

Qwen propone un AST numérico nuevo; un intérprete fijo lo ejecuta realmente sin eval, Function, JavaScript externo, red o archivos. Límites: 96 nodos, profundidad 12, 8.192 pasos, 128 números y 8.000 caracteres de salida. Los tres proyectos iniciales son suma de positivos, energía de señal y limitación [-1,1]. No es programación general ni entrenamiento neuronal.

Cada propuesta usa seis casos de desarrollo y seis reservados con juez versionado atlas-program-lab-1; los reservados no se envían al autor ni al revisor. Antes y después usan los mismos casos. Se conserva la semilla para reproducirlos. Todos deben pasar y un segundo modelo distinto y calificado debe aceptar una instalación o reparación. installed significa primera implementación: before es null, no un cero inventado. promoted exige más aciertos que la versión activa y ninguna regresión. retained/rejected/waiting conservan el programa anterior. Los errores de desarrollo alimentan el siguiente intento; las soluciones aceptadas de otros proyectos pueden recuperarse como referencias de código.

control.programming y run.programmingTrial guardan proyecto, actor, semilla, código, resultados, decisión, modelos, revisión y fecha. Las memorias programming de habitante/sala/módulo están separadas de creación visual, reflexión y ajustes de otros jueces. Todo se confirma en el mismo batch y lease de la investigación; repetir requestId no sintetiza de nuevo. No se sustituyen preguntas, roles, personalidades, fuentes ni la conversación Q histórica.

GET /api/cloud/program añade laboratory con proyectos y versiones. POST {operation:"evolved:positive-total",input:[...]} usa el prefijo evolved: seguido de positive-total, signal-energy o clip-unit para ejecutar la versión activa sin inferencia y sin guardar la entrada. Ejemplo: {"operation":"evolved:positive-total","input":[2,-3,5]}. El chat reconoce «Ejecuta programa positive-total [2,-3,5]» y atribuye la ejecución al intérprete, no a Qwen. La biblioteca fija anterior sigue disponible. /laboratorio permite comprobar datos y restaurar una versión anterior, con sesión del propietario y CAS contra vueltas en curso.

En una vuelta de programación se verifican programmingTrial.status/decision, before/after, el proyecto activo en GET /api/cloud/program y las tres memorias programming. No se exigen recibos de una vuelta documental, de coaching ni de creación visual. Sólo promoted acredita reparación medida en ese banco; installed añade una capacidad acotada nueva sin afirmar mejora previa. Una obra renderizada, una medición de audio y una ejecución numérica son pruebas diferentes.
