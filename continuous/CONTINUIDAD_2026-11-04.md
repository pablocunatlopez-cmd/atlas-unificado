# Continuidad de Atlas · 4 de noviembre de 2026

## Activación observada

El proceso activo cambió externamente entre las verificaciones del 3 y el 4 de noviembre. No se atribuye ese reinicio a esta sesión. A las 00:24 UTC ya respondían HTTP 200 `/runtime/status`, `/library/assessments` y la descarga completa `/library/export.csv`.

El chat respondió `{"ok":true}` mediante Qwen3.5-9B-Q4_K_M en 3.907 ms. La respuesta incluyó la procedencia por Response: llama.cpp, alias atlas-local, sin fallback y sin entrenamiento. Las otras APIs locales seguían sin modelo cargado acreditado. No hay otros modelos externos ni cuentas de créditos conectadas.

La muestra registró 36.329 repositorios únicos, dos expedientes C con puntuación null, cero élite y cero ganadores. Los objetivos siguen siendo 100.000/1.000/250 con 250 categorías propuestas. La espiral estaba habilitada, sin pausa, con 2.917 experiencias y un cambio medido conservado; los pesos Qwen no se declaran mejorados.

## Búsqueda por particiones

El coordinador ya ejecutaba la primera versión de particiones: tres nodos divididos y seis pendientes. La consulta real registrada para CAD tenía 4.346 resultados y se convirtió en dos rangos de fechas. Eso acredita ejecución de búsquedas, no calidad de los repositorios ni cobertura global del índice.

La revisión encontró y reprodujo tres defectos en bases sintéticas: páginas repetidas podían completar un pase de 1.000 resultados con solo 100 IDs distintos; refrescos históricos podían preceder a rangos nuevos; una cancelación coincidente con HTTP 503/429 podía tratarse como error o cuota.

La corrección conserva pases y miembros por ID GitHub, con máximo 1.000 miembros por pase, sin borrar observaciones anteriores. Solapes y huecos de identidad permanecen incompletos y llevan a subdivisión o saturación explícita. Los rangos pendientes tienen prioridad frente a refrescos completos. La cancelación se comprueba después de las cabeceras y antes de aplicar resultados, sin imponer una cuota de una respuesta ya cancelada.

Las tablas y columnas se añaden sin aumentar `PRAGMA user_version`. Un cursor antiguo sin evidencia de pase reinicia una vez su página, conservando todo el historial. El diagnóstico para verificar la carga de esta corrección es `discovery.segmentation.version === 2` y `passCoverageTracked === true`. La muestra del proceso activo todavía indicaba revisión 1: estas correcciones finales requieren el siguiente arranque.

La partición usa días UTC disjuntos, hasta 16 niveles y 4.095 nodos por categoría. Un día saturado no se declara completo. GitHub mantiene el máximo de 1.000 resultados por consulta; la estabilidad de su índice y la cobertura universal siguen sin demostrarse. Fuentes: [REST Search](https://docs.github.com/en/rest/search/search), [búsqueda de repositorios](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories).

## Mantenimiento y recursos

`runtime-inventory.mjs` comparte un único sondeo entre consultas normales y de salud, conserva vistas de 30 s y frescura de 5 s, y lee el estado de enrutamiento al devolver cada respuesta. Una consulta fallida no invalida una caché anterior todavía válida ni inicia otro sondeo mientras queda un lector pendiente.

`backup-maintenance.mjs` separa los respaldos de biblioteca y evaluaciones del ciclo de investigación externa. Guarda la intención antes de iniciar el snapshot; solo una copia verificada avanza la fecha de éxito. Los fallos conservan la copia anterior y pueden reintentarse a los 30 minutos, con revisión diaria tras un éxito. Dos peticiones concurrentes comparten la operación. El apagado espera la copia SQLite que ya se hubiera completado y conserva su evidencia.

El generador de políticas y geometría utiliza ahora el mismo adaptador de inferencia local que el chat. Sus alternativas exigen modelos ya cargados; no se inicia otro servidor ni se descarga un modelo al fallar el principal.

## Aprender de fallos distintos

El historial mostró numerosos intentos CSV con variantes de las mismas refutaciones. `repair-evidence.mjs` elige ejemplos completos y breves de diferencias distintas: códigos de error, forma del resultado y ubicación del primer desacuerdo. La agrupación es una heurística de presentación, no una prueba de equivalencia semántica.

El constructor conserva todos los contratos y regresiones para la validación. Solo reduce redundancia en el contexto enviado al modelo; limita la reproducción inicial a 64 casos y cede el turno cada cuatro para permitir cancelación. La confirmación nueva permanece fuera de los ejemplos de generación hasta su ejecución.

Un ensayo CPU aislado reprodujo una semilla existente: tres ejemplos ocuparon 1.598 caracteres e incluyeron `invalid_csv` y `limit_exceeded`. Se ejecutaron los 385 contratos completos y pasaron 54. No hubo generación de modelo, entrenamiento, candidata guardada ni promoción. La selección de contexto no se presenta como mejora de calidad aceptada.

## Interfaz y exportación

La página local `/library/` se actualizó sin reiniciar. Muestra expedientes, fuentes, puntuaciones pendientes, rangos de búsqueda y descarga CSV cuando la ruta existe. Se comprobó HTTP 200 y sintaxis de sus scripts. La revisión visual sigue pendiente porque el uso de navegador local está deshabilitado en Work.

La exportación HTTP completa contiene 36.329 filas y URL únicas, 27 columnas y 23.185.274 bytes. SHA256 `87740857a904fd5ca635c72717180ea4a5ef25367133a7b6440f2c14d5a32028`. Se guarda en `verification/atlas-v26-live-repositories.csv`; es una instantánea pública de metadatos, sin datos privados ni revisión completa de licencias.

## Verificación y publicación

Pasaron 622 pruebas backend, incluidas 33 de descubrimiento y las regresiones nuevas de respaldo, caché y selección de refutaciones. La fuente web V25 conserva sus 137 pruebas, TypeScript y build ya comprobados; no cambió en esta entrega. La publicación efectiva de Sites continúa en V24 mientras el source helper no alcance su servidor Git.

El nuevo `Restart-Atlas.ps1 -CheckOnly` volvió a recibir `CimException` al comprobar el puente, antes de enviar parada. No falta autorización. Se conserva el coordinador saludable y no se inicia uno paralelo. Los cambios finales de pases y de contexto de reparación se declaran pendientes de carga hasta verificar su diagnóstico y comportamiento.

Se ha comprobado una vía de lectura/escritura al repositorio autorizado mediante el conector GitHub, con la rama remota todavía igual a la última base conocida. La exportación revisada permite enviar los cambios sin renovar GitHub CLI ni copiar credenciales. La existencia de un commit local no se declara publicación: el checkpoint registra por separado la revisión remota confirmada cuando finaliza el envío.

Al reanudar, consultar primero este documento, `CLOUD_ACCESS.md` y el estado HTTP actual. No repetir ensayos fallidos ni reinicios por el mero paso del tiempo. Verificar la revisión 2 del descubrimiento al cargar módulos, conservar historiales y mantener una sola instancia de Atlas/Qwen.
