# Trabajo en vivo ligado a sesión (P3)

## Objetivo

Que Atlas **no** mejore Lía por sí solo solo porque el PC está encendido.
Una revisión autónoma “en vivo” solo tiene sentido cuando:

1. El servidor declara `liveCycleEnabled: true` (hoy **false** a propósito).
2. Hay al menos una pestaña con opt-in activo y visible (latido fresco).

## Piezas

| Capa | Archivo | Rol |
| --- | --- | --- |
| Contrato | `cloud/lib/session-heartbeat.ts` | Payload v1; fail-closed si pestaña oculta u opt-out |
| API | `/api/cloud/session-heartbeat` | GET estado; POST latido; **no** encola trabajo |
| UI | `LiveWorkOptIn`, `SessionHeartbeatStatus` | Interruptor + lectura honesta |
| Puerta PC | `continuous/session-live-work-gate.mjs` | Interpreta el GET; `mayStartLiveWork` |
| Puente | `continuous/atlas-cloud-bridge.mjs` | Reporta `sessionLiveWork` en cada tick |

## Comportamiento del puente

- **Siempre** consulta el GET de latidos y lo escribe en `cloud-bridge-status.json` (`sessionLiveWork`).
- Chat, vídeo, LOR, mundos: **no** dependen del opt-in (siguen el claim normal).
- Trabajos `review` (revisión autónoma):
  - Por defecto **no** se bloquean (`enforceSessionLiveWork=false`).
  - Con `ATLAS_ENFORCE_SESSION_LIVE_WORK=1` el puente rechaza `review` si `mayStartLiveWork` es false.

## Cómo activar el endurecimiento (cuando toque)

1. Publicar Sites con la API de latidos y la UI de opt-in.
2. Cambiar en servidor `liveCycleEnabled` a `true` (decisión explícita; hoy no está hecho).
3. En el PC: `ATLAS_ENFORCE_SESSION_LIVE_WORK=1` y reiniciar el puente.
4. Abrir la casa o `/actividad/`, activar **Trabajo en vivo · on**, dejar la pestaña visible.

Hasta el paso 2, `mayStartLiveWork` será siempre false: el sistema falla cerrado.

## Qué no hace este contrato

- No prueba que una mejora esté integrada (eso es evidencia tipada).
- No sustituye el lease del puente ni el token del coordinador.
- No almacena latidos de forma durable (memoria por isolate).
