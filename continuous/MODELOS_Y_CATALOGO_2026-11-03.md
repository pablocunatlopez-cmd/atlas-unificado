# Modelos, evaluación y biblioteca · 3 de noviembre de 2026

## Resultado comprobado

- El catálogo original de 117 herramientas ya estaba importado. La auditoría comprobó su igualdad con el adjunto mediante SHA256 `09d7c8c464b061762d5af2c7fd1ef310cd02282d6072cb26645d32a8e43e45df`. Se conservan las afirmaciones originales como nivel D; no se convierten en instalaciones o licencias verificadas.
- A las 19:11 UTC, `/library/status` registró 34.073 repositorios GitHub únicos, 2.141 comprobaciones de metadatos, 250 categorías propuestas y cero élite/ganadores. Los objetivos siguen siendo 100.000 → 1.000 → 250. No está completado el catálogo final ni la validación de categorías.
- El chat del coordinador respondió HTTP 200 al ensayo JSON en 2.389 ms, con Qwen3.5-9B-Q4_K_M y `trained:false`. La consulta directa previa al servidor de modelos agotó 65 segundos mientras había trabajo en su única ranura. Usar el coordinador conserva la prioridad del usuario; no sustituirlo por clientes que compitan con la espiral.
- El coordinador actual siguió activo y la espiral habilitada. La muestra registró 2.788 experiencias y un cambio medido conservado, contadores distintos de las generaciones de políticas y de los ensayos de constructores. Los pesos Qwen no se dan por mejorados.

## Motores y modelos

`runtime-options.mjs` distingue software instalado, API compatible, inventario descargado, modelos cargados e inferencia. Consulta siete rutas fijas de loopback con plazos y tamaños limitados. No transmite claves ni rutas privadas y no inicia procesos.

Se detectaron los binarios existentes de llama.cpp y Ollama. La API de llama.cpp respondió a salud; su inventario anónimo requiere autenticación. Ollama, LM Studio y LocalAI no respondieron como API en el diagnóstico. Esto no acredita que los dos últimos estén ausentes de todo el equipo.

Por `stat`, están presentes los pesos configurados Qwen3.5-9B (6.169.341.984 bytes) y Qwen3-4B-Instruct-2507 (2.497.281.120 bytes). Presencia y tamaño no vuelven a verificar su integridad ni prueban dos modelos cargados simultáneamente.

`local-inference-router.mjs` conserva llama.cpp como ruta principal y puede descubrir hasta dos alternativas locales ya cargadas cuando falla el transporte principal con error de red o HTTP 502/503/504. Exige un diagnóstico reciente, alias exacto y prueba de carga de Ollama o LM Studio. No utiliza un simple listado de archivos como prueba de carga. LocalAI queda en inventario por falta de comprobación equivalente. La preferencia nominal por Qwen no mide calidad.

El adaptador no arranca servidores, descarga pesos ni llama a APIs de gestión. Nunca reenvía la clave principal a otra API y no reintenta una generación después de entregar su stream. El servidor podría desalojar un modelo entre el sondeo y la petición: no se garantiza que un proveedor local evite toda recarga. La procedencia se conserva por cada Response mediante WeakMap; el chat atribuye la respuesta final y cada generación a su ruta real. La integración abarca el chat compartido, privado y la planificación de herramientas.

## Servicios externos

Condiciones consultadas en documentación oficial el 3 de noviembre de 2026:

- [Groq](https://console.groq.com/docs/rate-limits): publica un plan gratuito con límites por modelo y organización. Requiere cuenta y clave propias. No hay acceso ni cuota de una cuenta verificados en Atlas.
- [Cerebras](https://inference-docs.cerebras.ai/support/rate-limits): prueba de 5 USD con caducidad de 30 días y verificación de un método de pago; no es una cuota gratuita renovable. No se ha activado.
- [Hugging Face](https://huggingface.co/docs/inference-providers/en/pricing): la cuenta Free no incluye créditos mensuales de Inference Providers. Descargar pesos abiertos no equivale a disponer de inferencia remota gratuita.

No se crearon cuentas, consumieron créditos, copiaron sesiones de Codex/Claude ni conectaron modelos externos. Las capturas aportadas se usan como referencia de estética y condiciones históricas, no como credenciales o prueba del equipo de Atlas. La guía revisable v3 incorpora estas distinciones al siguiente arranque.

## Evaluaciones con evidencia

`library-assessment.mjs` implementa la rúbrica invariable 30/20/15/15/10/10. Una puntuación desconocida permanece null. Cada puntuación aportada requiere justificación y referencias existentes. Excelencia técnica, valor estratégico, coste, derechos y confianza permanecen separados.

La elegibilidad exige pruebas estructuradas y coherentes: commits fijados, hashes de artefactos, fechas, método, revisión jurídica y de seguridad; una candidatura a ganador requiere además pruebas reproducibles y comparación. La validación de estructura no ejecuta las pruebas ni establece derechos. Elegible para revisión nunca significa seleccionado.

El ledger SQLite separado tiene escrituras transaccionales, registros sin actualización/borrado, rúbrica fija y cadena SHA256 de JSON canónico. Comprueba toda la cadena y las definiciones de triggers antes de añadir un registro. No tiene firma criptográfica de autenticidad. No modifica el esquema de la biblioteca de descubrimiento.

Se conservaron dos expedientes preliminares reales, de llama.cpp y Ollama, basados únicamente en los metadatos GitHub ya guardados. Ambos son C, tienen puntuación null y no son élite ni ganadores. El registro pasó integridad y recibió una copia consistente mediante `node:sqlite.backup`, con SHA256 y comprobación SQLite. La integración prepara respaldo diario independiente del ledger.

## Exportación y HUD

`repository-export.mjs` genera CSV desde una conexión SQLite propia de solo lectura y un snapshot transaccional. Limita 100.000 filas y bloques de 64 KiB, admite cancelación/plazo y libera la conexión incluso si el consumidor deja de leer. Protege fórmulas de hojas de cálculo y separa afirmaciones importadas de licencias de sus metadatos. Excluye rutas de fuentes privadas, secretos, historiales y errores sin filtrar.

La exportación ejecutada contiene **34.073 filas y URL únicas**, 27 columnas y 21.775.112 bytes. SHA256: `0f1030d274d02841e98f7a87d3acd0c583c4a9cd3d5f128cf9ed52ab1cbe5980`. Se conserva en `verification/atlas-repositories.csv`; es una instantánea fechada, no un contador vivo ni una revisión de código.

La página local `/constellation/` se actualizó sin reiniciar: ensayos de Aider/smolagents/constructor, experiencias, contadores de biblioteca, diagnóstico fechado de motores y condiciones de créditos. El control antiguo OpenRouter se conserva plegado y solo consulta su catálogo al abrirse. La página respondió HTTP 200 y sus scripts compilaron; no se pudo comprobar el render porque el uso de navegador local está deshabilitado en Work.

## Carga y publicación pendientes

- Las nuevas rutas `/runtime/status`, `/library/assessments` y `/library/export.csv`, el router y la guía necesitan cargar el código nuevo del coordinador. Las dos primeras devolvieron 404 en el proceso actual. No se declaran activas por haber editado los archivos.
- Tras observar un cambio externo de PID se repitió solo `Restart-Atlas.ps1 -CheckOnly`: confirmó la identidad del servicio, pero CIM volvió a denegar la comprobación del puente antes de cualquier parada. No falta autorización del usuario. No se detuvo ni duplicó el coordinador.
- El lector Sites V25 conserva ocho referencias oficiales, fragmentos limitados, hash, fecha, caché y cancelación; añade documentación pertinente al transporte del chat sin cambiar el historial original. Se corrigieron las introducciones de Three.js que aparecen antes del artículo. Las lecturas anteriores se conservaron; el nuevo sondeo externo falló por acceso de red de esta sesión.
- La fuente V25 pasó **137 pruebas web**, TypeScript y build de producción. No se publicó: el source helper no pudo conectar con el servidor Git de Sites. La versión pública verificada sigue siendo **V24**. No usar una versión inventada ni afirmar que GitHub contiene estos cambios.
- El backend pasó **585/585 pruebas**, incluidas las nuevas de motores, fallback, atribución, ledger y exportación. Los cambios posteriores de integración de respaldo conservan las pruebas del módulo de backup y la comprobación de sintaxis; no acreditan una carga del servidor nuevo.

## Reanudación

Leer este documento, `CLOUD_ACCESS.md` y el estado HTTP vigente. Comprobar carga de rutas sin iniciar otro servidor. Cuando Windows permita el preflight, usar el lanzador canónico autorizado y verificar salud, chat, espiral y rutas. Publicar el checkout existente de Sites mediante su source helper con credencial nueva cuando se restaure la red. No repetir autenticación GitHub pospuesta.

Quedan pendientes, entre otros requisitos del mandato completo: segmentación de consultas truncadas, revisión de las 250 categorías, evaluación jurídica/técnica y comparación de candidatos suficientes, ganadores acreditados, instalación medida de analizadores y conexiones externas con cuenta propia. Este trabajo no cumple todavía la meta final 100.000/1.000/250 ni convierte todos los 117 elementos en herramientas instaladas.
