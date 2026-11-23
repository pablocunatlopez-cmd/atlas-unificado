# Pico: contrato de reintentos de acciones — 22-11-2026

Estado inicial conservado: candidata probada, NO publicada en el intento 92. La integración posterior se documenta al final. Atlas publicado permanece v66 / a430459d2b2f7f8d63e166838acf5242bc9c5145; ERAS permanece v13 / 43ea8968dc66c453da9c29d1ca469c91e177a2bc. Las aperturas nativas no encontraron cambios nuevos en ambos repositorios. GitHub main sigue 86b08002ed57a806d3a270f362a326f3ae694dd3; no se modifica esa línea ni PR1. Los catálogos y su procedencia permanecen sin cambios, sin identidades nuevas.

Encargo abierto work-bf7a2997-7f38-407d-a3d7-4e9206406a30; propietario lógico resident:body-arm, Pico (Acciones y contratos). Beneficio para Lía: un reintento no debe recibir silenciosamente una acción con distinta opción de búsqueda pública, tipo o parámetros. Este contrato no modifica contenido de conversaciones existentes ni ejecuta búsquedas.

## Defecto reproducido e implementación candidata

`lib/cloud/queue.mjs` compara question/kind/parameters en la lectura inicial pero omite internet. En la lectura posterior a INSERT OR IGNORE sólo compara question/conversation_id. Se reprodujeron ambos fallos con las migraciones reales sobre SQLite: cambiar internet con el mismo requestId devuelve éxito; dos llamadas que compiten con payload distinto pueden recibir ambas éxito.

Se normaliza internet una vez como 0/1 y se compara antes y después de insertar. La lectura posterior incluye internet/kind/parameters y rechaza con 409 cualquier diferencia. Se conserva INSERT OR IGNORE y el batch existente: no se inventan bloqueos de fila ni una transacción manual de D1. Un reintento idéntico conserva jobId y un solo mensaje; el acceso por usuario, límites y leases siguen vigentes.

## Fuentes y rechazo

La consulta específica engineering:pico-queue-request-contract-20261122 produjo icarus-92. Se leyeron:

- Cloudflare D1Database: https://developers.cloudflare.com/d1/worker-api/d1-database/ (source-6aa78f40fd1146c3b865fed5). batch ejecuta sentencias en transacción y revierte el conjunto si falla una; no documenta bloqueos manuales de fila para este contrato.
- MDN Idempotent: https://developer.mozilla.org/en-US/docs/Glossary/Idempotent (source-e759eec4f0ef28d20594775c). POST no garantiza idempotencia por sí solo; aquí el servidor implementa su propio contrato por requestId.

GPT-OSS120B y Qwen completaron respuestas. Qwen RECHAZÓ: repositoryEvidence.entries está vacío para queue.mjs. La propuesta además sugería bloquear una fila sin demostrar que esa API exista; no se ejecuta tal instrucción. Se conserva rechazo, no se envía recibo y no se publica la corrección. Los dos primeros envíos de la misma consulta excedieron el contrato de 600 caracteres y recibieron 400; el tercero corrigió la longitud y conservó requestId. No se consumió inferencia en esos errores de entrada.

Pendiente: aportar al contexto compartido un fragmento explícitamente inspeccionado del enqueue de queue.mjs, con hash completo y ventana que realmente incluya la función; el mecanismo actual sólo admite grounding.ts/program-tools.mjs y primeros 2000 caracteres. No escanear memoria privada ni ampliar automáticamente todo el repositorio. Después formular otro intento que resuelva el rechazo y descarte bloqueos de fila inexistentes. Las pruebas de ejecución ya recogidas no convierten por sí solas el rechazo en aprobación.

## Comprobaciones realizadas

Las dos nuevas pruebas de defecto fallaron en la base sin modificar el juez. La fixture de SQLite añade una barrera anterior al batch para forzar que ambas llamadas hayan leído el mismo estado antes de insertarse; no sustituye SQL por un mock. La tercera prueba conserva el caso concurrente idéntico.

52/52 pruebas pasan con:

`node --test lib/cloud/queue.test.mjs tests/atlas-chat-races.test.mjs lib/house/realism.test.mjs lib/house/house-quest.test.mjs tests/atlas-functional-cinema.test.mjs`

Incluyen true→false y false→true, replay exacto, lectura de la opción original por claimOwned, carreras de internet/tipo/parámetros, replay concurrente idéntico, una sola escritura por turno, aislamiento, cancelación y leases. Las regresiones afectadas y exigidas de casa/PBR/prototipo/cine también pasan. No se debilitaron pruebas existentes. TypeScript `--noEmit --incremental false`, snapshot de evidencia `--check` y compilación completa `build-site.mjs` correctos. Son comprobaciones CPU/SQLite, no una carrera distribuida observada en D1 de producción ni prueba GPU. No se ejecutaron inferencias de prueba, ni se encendió un PC.

## Vuelta y límites

La vuelta normal scheduled:2026-11-22T07 produjo 02b5ce44-8e0f-4e4b-99a2-d42a101a86d2 / icarus-91 (sense:audio). Se leyeron sus extractos AnalyserNode y AudioBuffer. Su propuesta de separar métricas no se aplica automáticamente: signals.ts ya calcula pico, RMS, media/DC y muestras cercanas al límite, y la UI ya lo conecta al primer canal. No se presenta como capacidad ausente ni se crea otro módulo duplicado. La medición instrumental no equivale a escucha semántica.

Presupuesto releído: 26/60, margen automático 48. Agenda, proveedor, cuota, privacidad y versiones publicados permanecen iguales. Sin despliegue ni record/record-engineering, la cola de Pico sigue abierta. No se acredita entrenamiento de pesos ni aprendizaje continuo por no haber publicación.


## Reanudación con código visible: icarus-94

La publicación intermedia v67 / f1825055e7f92c380fa932e526eef6b2a981a881 aporta la ventana real de enqueue al contexto compartido, con hash completo, posiciones, límite y guardia de obsolescencia. No cambió la cola. Ícarus-94, engineering:pico-queue-code-evidence-resume-20261122, recibió esa evidencia y ambas fuentes releídas; GPT-OSS120B y Qwen completaron propuesta/revisión, ahora admitida. Se conservan 92 y el rechazo normal 93 (eras-character:ice:warrior, sin código de ERAS visible), sin recibos para ellos. El rechazo 93 no se convierte en una aplicación de gráficos.

Se integra la candidata 66649d1 sin añadir transacciones manuales ni bloqueos de fila. La comparación inicial ya incluía kind/parameters y sólo le faltaba internet; la posterior no incluía los tres campos. La descripción general del modelo simplifica esa diferencia: el diff y las pruebas fijan el alcance real. El ejecutor añadió la dependencia necesaria en app/cloud-chat.tsx: la identidad del reintento incluye internet, lo conserva al fallar el transporte y crea un identificador nuevo si cambia esa opción. Un test del handler real falló antes de este ajuste y cubre ambos cambios, reintentos idénticos y una referencia antigua sin flag.

Se regenera repository-evidence.ts desde la reparación inspeccionada; el fragmento anterior queda en v67 y el nuevo coincide con el archivo. Las nueve pruebas de evidencia/contexto se suman a las 52 anteriores y a la prueba del cliente: 62 pruebas en conjunto. La cobertura incluye límites, aislamiento, cancelación, proyectos y leases; las carreras son SQLite con barrera controlada, no observación distribuida de D1 en producción. No se llama a inferencia para demostrar el arreglo. Tipos y build deben pasar antes del push y publicación final. El recibo de 94 y el cierre del encargo de Pico sólo se comunican después del despliegue terminal con SHA/versión reales; son reportes del flujo autenticado, no verificación independiente del Worker. No hay entrenamiento de pesos.
