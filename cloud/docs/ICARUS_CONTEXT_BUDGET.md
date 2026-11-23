# Presupuesto de contexto de Ícaro

Intervención del 21 de noviembre de 2026, misión `resident:sky-agents`, consulta `icarus-70`.

## Defecto y evidencia

La consulta `icarus-69` conservó fuentes y una propuesta completada por `openai/gpt-oss-120b`, pero su revisión por `qwen/qwen3.8-27b` quedó indisponible: «El contexto supera el límite de esta vuelta». Ese fallo anterior se conserva. El transporte suma las unidades UTF-16 de los contenidos de los mensajes y rechaza más de 16000 antes de reservar una llamada. Añadir el JSON completo de la propuesta al mismo inventario, dos extractos de 2800 unidades y tres antecedentes podía superar ese límite.

Fuentes realmente leídas para esta misión:

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify — la serialización añade estructura y escapes; medir los campos originales no basta.
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length — `.length` cuenta unidades UTF-16, la misma unidad del control de transporte; no son tokens ni bytes.

Ícaro completó propuesta GPT-OSS120B y revisión Qwen en `icarus-70`, con ambos modelos calificados. La sugerencia situaba una comprobación en el catálogo de agentes. La inspección del código muestra que el mensaje se construye realmente en `lib/collaboration/server.ts`; allí se integra el ajuste. La aceptación del colaborador no acredita la ejecución ni reemplaza las pruebas de ingeniería.

## Intervención

`lib/collaboration/context.ts` construye mensajes desde el contexto común de la misión. Serializa el objeto completo para medirlo y vuelve a serializar tras reducir campos opcionales. Conserva identidad/arquitectura, beneficiaria, encargo y validaciones actuales, inventarios de ambos proyectos, identificadores y títulos de las fuentes y la propuesta íntegra del revisor. Los criterios de ambos mensajes de sistema permanecen literalmente iguales a v58.

Primero acorta los detalles narrativos de propuestas/recibos anteriores. Conserva todos sus identificadores, estados y errores, incluidos los rechazos. Si aún falta espacio, acorta los mayores extractos documentales manteniendo un prefijo de unas 256 unidades por fuente. `contextBudget` declara las unidades históricas retiradas y los documentos abreviados. Los registros persistidos y los documentos de entrada no se modifican.

El contexto sin propuesta se limita a 10000 unidades; para el revisor se añade el tamaño serializado real de la propuesta y se respeta siempre el límite conjunto de 16000 con sus instrucciones. Ambos reciben la misma misión, inventarios y fuentes; los extractos opcionales pueden ser más cortos en la revisión si la propuesta necesita espacio. Nunca se corta una cadena JSON serializada. Si lo obligatorio no cabe, se informa del bloqueo antes de enviar la petición. No se cambia el límite del transporte, proveedor, modelos, baremo, cuota ni reserva del chat, ni se añaden reintentos de inferencia.

## Comprobación reproducible

`tests/atlas-review-context.test.mts` usa las instrucciones reales del servidor, una propuesta admitida por el contrato, dos documentos y tres antecedentes con citas, barras, saltos de línea y Unicode. En la misma entrada:

| Resultado | Antes | Candidata |
| --- | --- | --- |
| Entrada del revisor, unidades UTF-16 | 20434 | 15141 |
| Transporte real con respuesta de red sustituida localmente | Rechaza antes de reservar | Una reserva y una petición simuladas |
| Rechazo devuelto por el revisor simulado | No llega a revisarse | Sigue siendo rechazo |

También se comprueban conservación de misión/propuesta/fuentes, ausencia de mutación de antecedentes, entradas pequeñas completas y rechazo explícito de un encargo obligatorio sobredimensionado. Los tests no consultan Groq ni consumen la cuota real. No se trata de una repetición del modelo para fabricar progreso.

La capacidad concreta es preparar entradas revisables dentro del límite existente. Esto reduce un fallo reproducible de colaboración al servicio de Lía; no prueba mayor razonamiento de los modelos ni verdad documental. Recortar un extracto puede retirar evidencia pertinente y el revisor debe seguir rechazando si falta apoyo. La prueba no acredita calidad artística, ejecución GPU, escucha ni entrenamiento de pesos. La consulta 70 se completó antes de desplegar esta candidata y no se presenta como ensayo del nuevo código en producción.

## Procedencia y límites de sincronización

Se parte de Atlas v58 / `423142aaac210735d4c113300f4e07b91471e4ac`, sin cambios ajenos locales. ERAS permanece en `43ea8968dc66c453da9c29d1ca469c91e177a2bc` (v13). GitHub `main` fue inspeccionado en `86b08002ed57a806d3a270f362a326f3ae694dd3`; su línea y el PR existente se conservan, sin forzar ni sobrescribir. No hay incorporación de identidades o cambios de catálogo en esta intervención. El motor ERAS, sus consumidores y el mundo funcional/PBR no se modifican.
