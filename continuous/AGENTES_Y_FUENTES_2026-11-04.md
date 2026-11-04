# Atlas: diez especialistas y fuentes con permisos y versiones

El usuario eligió A y B: añadir diez especialistas y reforzar permisos, vigencia, recuperación y citas. Se integran en el coordinador único existente. No se crean diez servidores, diez modelos independientes ni llamadas a proveedores externos.

## Diez funciones

Memoria, recuperación, vigencia, citas, seguridad, evaluación, recursos, programación, 3D y coordinación. Cada función tiene comprobaciones locales ejecutables y un mandato para Qwen. El chat hace diez comprobaciones acotadas antes de generar. Cuando corresponde revisar, selecciona dos perspectivas para la revisión existente de Qwen: no añade diez generaciones. El informe distingue comprobaciones automáticas, consulta de perspectivas intentada, completada o fallida, y modelos independientes (cero).

La espiral ejecuta estas comprobaciones al observar memoria, preparar una acción y contrastar el resultado. Las perspectivas se incorporan a las consultas que ya hacía Qwen, sin inferencias adicionales. Siguen existiendo la predicción anterior a Ion, la ejecución física y después Dios/Suceso y LOR. Estas revisiones no son aprendizaje de pesos ni una prueba de mejora por sí solas.

## Fuentes y citas

Antes de puntuar se comprueban el ámbito, las ACL explícitas, las fechas de validez y las revocaciones. La sesión compartida no recibe el corpus, mandato personal, inventario de juegos, notas privadas ni memoria importada del propietario, incluso si el llamador los aporta por error.

Las versiones se agrupan únicamente por identificador canónico declarado, nunca por parecido del texto. La última versión revocada o caducada no resucita una anterior. Los conflictos sin versión permanecen pendientes salvo que exista una única versión marcada vigente. Una futura versión espera su fecha. `fetchedAt` registra la lectura y no demuestra vigencia.

Estos metadatos deben venir de ingesta confiable; un README no puede concederse permisos ni declararse autoridad. Los documentos históricos sin metadatos siguen disponibles para el propietario bajo el comportamiento anterior: no se inventan fechas o versiones.

Las fuentes llevan hash SHA256 e identificador estable; el coordinador asigna F1/F2 para las citas del turno. Los destinos ejecutables o con credenciales se excluyen. Las citas públicas preservan los parámetros y fragmentos que identifican la página. Las etiquetas inexistentes se señalan al devolver la respuesta. Comprobar identidad y procedencia no demuestra que una fuente sea verdadera ni respalde semánticamente cada frase.

## Estado y visibilidad

El chat local muestra las comprobaciones realmente recibidas y las perspectivas de Qwen que completaron la revisión. `/specialists/status` exige el token del propietario y rechaza un Origin ajeno. Los contadores solo conservan IDs, estados, tiempos y cuentas del proceso actual: nunca preguntas ni extractos, y empiezan en cero tras arrancar. No se simulan diez procesos permanentes.

La interfaz local se sirve desde disco. A y B quedaron cargadas tras un arranque externo a esta ejecución: PID 19644, inicio 04/11/2026 06:03:52 en la hora local del PC. La ruta protegida `/specialists/status` respondió 200 con 159 revisiones y 1.590 comprobaciones, última revisión de la espiral registrada el 04/11/2026 a las 06:55:58 UTC. Una pregunta real al chat devolvió «Hay 10 especialistas locales determinísticos y 0 modelos independientes», con Qwen3.5-9B y diez comprobaciones, en 12,5 segundos. No se atribuye ese arranque a un reinicio realizado aquí.

Sites está público en V24. Su base de datos registró un latido reciente del puente con Qwen3.5-9B; ese latido no sustituye la prueba de respuesta local ni acredita una respuesta remota por sesión. El chat móvil es `/chat/` y requiere iniciar sesión. La nueva apertura del source helper volvió a fallar al conectar con git.chatgpt-team.site, por lo que no se declara una publicación nueva de Sites. GitHub conserva su propia visibilidad privada.

Se corrigió además un fallo de recuperación: una carga inicial fallida podía conservar indefinidamente su promesa rechazada tanto en la espiral como en la memoria de evidencias. Ahora un intento posterior vuelve a leer el disco y las llamadas concurrentes comparten una carga. Los archivos corruptos se conservan y siguen produciendo error hasta una reparación explícita; no se sustituyen por memoria vacía. Esta corrección posterior necesita carga verificada: el proceso activo empezó antes de esos cambios. No se repite el preflight CIM denegado ni se para el coordinador saludable para forzarlo.

## Verificación reproducible

La suite completa de A y B pasó 667/667 pruebas, sin omisiones. La corrección posterior de recuperación añadió cuatro regresiones que fallaron antes del cambio y pasaron después; 59 pruebas relacionadas verificaron recuperación, concurrencia y preservación de corrupción. Registro local completo: `verification/atlas-ab-2026-11-04-tests.log`. La prueba de integración de la espiral ejecutó tres revisiones de diez funciones conservando las dos generaciones y una consulta que ya necesitaba; la cancelación evitó consultas y comprobaciones posteriores.

Tras incorporar la recuperación, la suite final completa pasó **671/671**, sin fallos ni omisiones.

`node --test chat-specialists.test.mjs atlas-specialists.test.mjs specialists-status.test.mjs retrieval-policy.test.mjs citation-audit.test.mjs experience-specialists.test.mjs`

Las pruebas usan modelos simulados, corpus sintéticos y directorios temporales. Cubren versiones y revocaciones, permisos cambiados después de cachear, aislamiento compartido, citas inexistentes, límites, cancelación, telemetría sin texto y reutilización de las inferencias existentes. No acreditan calidad general de Qwen, calidad visual 3D ni modelos externos conectados. El ensayo no descarga modelos, instala frameworks ni realiza llamadas facturables.
