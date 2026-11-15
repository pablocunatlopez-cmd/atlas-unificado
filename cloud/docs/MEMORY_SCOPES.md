# Memoria de Atlas y de los habitantes

Este documento separa dos capas que no deben mezclarse:

1. **Memoria personal con ámbito**, escrita o confirmada por la persona.
2. **Observaciones autónomas de los habitantes**, formadas por el servidor a partir de telemetría real de procesos.

Ninguna de las dos capas demuestra consciencia, aprendizaje autónomo, personalidad individual ni verificación independiente.

## 1. Memoria personal con ámbito

La memoria personal existente vive en `atlas_state`, aislada por usuario. Ahora cada nota tiene un ámbito cerrado:

| Ámbito | Clave | Uso |
| --- | --- | --- |
| General | `global` | Contexto compartido por el chat general. Es el valor por defecto. |
| Habitante | `resident:<id>` | Nota asociada a un puesto del roster actual. |
| Sala | `room:<id>` | Nota asociada a una de las salas de `layout.js`. |
| Módulo | `module:<id>` | Nota asociada a una superficie actual: `house`, `chat`, `activity` o `workshop`. |

Reglas:

- Las claves se validan contra `cloud/lib/core/memory-scopes.mjs`; un identificador inventado no crea un espacio nuevo.
- `memoryKnowledge(state)` recupera solo `global` por defecto. Un ámbito debe pedirse explícitamente, así que una nota de un habitante no se mezcla en silencio con el chat general.
- El selector de la vista Memoria agrupa las opciones y el formulario guarda el ámbito elegido.
- `module:<id>` se refiere a las cuatro superficies actuales. No afirma que sean los cuatro módulos históricos que la lista del propietario no nombra.
- Los ámbitos no son permisos ni identidades: son etiquetas de recuperación dentro del mismo estado personal del usuario.

Implementación: `cloud/lib/core/memory-scopes.mjs`, `cloud/lib/atlas-core.ts`, `cloud/lib/atlas-validation.ts`, `cloud/app/atlas-app.tsx`.

## 2. Observaciones autónomas por habitante

### Qué se registra

Solo se registra un **resultado terminal reportado** por el coordinador para un proceso que pertenece a un puesto real del roster:

- `passed` → «resultado reportado».
- `failed` → «fallo reportado».
- La fase se conserva si el coordinador la comunica (`observe`, `understand`, `connect`, `apply`, `refute`, `retain`).
- El texto se construye con una plantilla cerrada que incluye el habitante, el proceso y la fase. No se copian prompts, tokens, rutas, código ni contenido de usuario.

Un puesto con `activePhases` solo recibe el resultado cuando la fase comunicada le corresponde. Por ejemplo, Nilo recibe `experience` en `apply`/`refute`; Nora lo recibe en `observe`/`understand`/`retain`.

### Cómo se forma

```
PC / puente
  → heartbeat con processTelemetry saneada
  → cloud_bridge.capabilities
  → GET /api/cloud/status (la casa consulta el estado)
  → buildResidentMemoryEvents()
  → INSERT OR IGNORE en resident_memories
  → GET /api/house/memory?resident=<id>
  → tarjeta «Memoria observada» al seleccionar un habitante
```

La escritura no la hace el navegador: no existe un `POST` de memoria de habitante. El cliente solo lee. La formación es automática cuando la casa consulta la telemetría; **no hay un demonio en segundo plano** que siga observando con la casa cerrada.

### Límites y garantías

| Límite | Valor |
| --- | --- |
| Frescura de la telemetría | 75 s; horas futuras o inválidas se rechazan |
| Estados que generan memoria | solo `passed` y `failed` |
| Ventana de deduplicación | 30 min por habitante + proceso + estado + fase |
| Eventos por pasada | máximo 12 |
| Retención | 30 días; la poda se ejecuta al registrar observaciones nuevas |
| Lectura por habitante | máximo 20 observaciones |
| Identificadores | solo puestos no decorativos del roster |

La tabla `resident_memories` es **global**, como `cloud_bridge`: no contiene `user_id` ni datos privados. Se deriva de telemetría que ya es pública para la casa. La API de lectura es de solo lectura y no devuelve información de otras tablas.

### Lo que no hace

- No aprende pesos, no entrena y no cambia el modelo.
- No verifica el resultado: repite lo que el coordinador reportó.
- No crea una personalidad, una voz o una memoria autobiográfica.
- No inventa recuerdos para Noa, Ritmo ni los seis espectadores: no tienen un proceso asignado.
- No sustituye la memoria personal del usuario ni se inyecta en el chat general.
- No garantiza que el proceso haya terminado con éxito independiente; solo conserva el estado comunicado.

## 3. Migración y despliegue

La tabla se define en `cloud/db/schema.ts` y la migración generada es `cloud/drizzle/0006_closed_marvel_zombies.sql`.

Antes de desplegar:

```bash
cd cloud
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB \
  --local --config dist/server/wrangler.json --persist-to .wrangler/state \
  --file drizzle/0006_closed_marvel_zombies.sql
```

En producción, aplica la migración con el procedimiento de D1 del proyecto antes de publicar el código que lee o escribe `resident_memories`. Sin la tabla, `/api/cloud/status` sigue respondiendo (la observación es best-effort) pero `/api/house/memory` devuelve un error de almacenamiento.

## 4. Pruebas

- `cloud/lib/core/resident-memory.test.mjs`: frescura, estados terminales, atribución por fase, límite y claves cerradas.
- `cloud/lib/cloud/queue.test.mjs`: deduplicación, aislamiento de la tabla, rechazo de identificadores desconocidos, caducidad y segunda ventana.
- `cloud/lib/core/memory-scopes.test.mjs`: claves de ámbito cerradas.
- `cloud/tests/atlas-state-scope.test.mts`: validación de ámbitos en el estado.
- `cloud/tests/atlas-core.test.mts`: no fuga entre ámbitos en la recuperación.

Véase también [el catálogo de habitantes](CHARACTER_CATALOG.md) y [el contrato de telemetría](PROCESS_TELEMETRY_CONTRACT.md).
