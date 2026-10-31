# Atlas: investigación pública y mejora acotada

Proyecto: `appgprj_6acdbbc1ce80819192cfb514a4cd474f`.
Se preserva acceso exclusivo del propietario. No ampliar audiencia sin sustituir la autorización del actualizador compartido.

## Qué ejecuta

Atlas consulta Wikipedia en español e inglés, Crossref y, en temas técnicos, metadatos de repositorios públicos de GitHub. El lector HTTPS admite el catálogo exacto de `lib/research/web.ts`; no es un navegador de cualquier dominio, no interpreta JavaScript de páginas y no lee PDF. Los fallos de proveedores se conservan, y los otros proveedores pueden continuar. No necesita API keys ni modelos externos.

Cada ejecución de agenda lee hasta tres extractos nuevos. Recorre programación, render, evaluación, modelo propio, evidencia, ciencia, ecología y semiosis; intercala una pregunta de contraste generada por una regla fija a partir del título de una fuente nueva. La siguiente ejecución usa realmente esa pregunta antes de rotar al próximo tema. Una consulta manual no desplaza la agenda. No afirma deliberación de un modelo. La conversación Q histórica sigue siendo una instantánea separada.

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
