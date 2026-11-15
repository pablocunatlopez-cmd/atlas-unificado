# Inventario de rutas · Atlas / Lía (Sites)

Fuente de verdad de superficies HTTP del frontend en `cloud/app`.
No afirma que una ruta ejecute trabajo autónomo ni que el PC esté conectado.
Actualizar este documento cuando se añada o retire una ruta.

**Fecha de inventario:** 2026-11-15 · commit base de referencia: tip de `main`.

## Clasificación

| Clase | Significado |
| --- | --- |
| **product** | Superficie principal de Lía; debe permanecer navegable y coherente con la identidad Atlas / Ion / Ícaro. |
| **deep-link** | Entrada a la misma experiencia de producto con un foco concreto (sala, panel). |
| **legacy** | Experimento o workspace histórico conservado; no es el hogar canónico. |
| **api** | Endpoint de servidor; no es una página de usuario. |

## Páginas (App Router)

| Ruta | Clase | Componente principal | Propósito canónico | Auth | Notas |
| --- | --- | --- | --- | --- | --- |
| `/` | product | `atlas-house.tsx` | Casa 3D de Lía: mente, cuerpo, cielo; espejo de telemetría | Opcional (ChatGPT) | Diez salas; deep-link `?room=` |
| `/chat/` | product | `cloud-chat.tsx` | Conversación compartida con el PC vía puente | Opcional | Historial privado por usuario en D1; `sharedSession` en el puente |
| `/actividad/` | product | `learning-dashboard.tsx` | Actividad reportada, catálogo de herramientas, ciclos | Pública de lectura | Solo muestra lo que el coordinador/API reporta |
| `/taller/` | product | `taller/page.tsx` → paneles creativos | Taller de mundos / proyectos creativos del usuario | Según página | No es el generador autónomo del PC |
| `/origen/` | legacy | `atlas-app.tsx` | Workspace histórico de herramientas anteriores a la casa | Según app | Conservar navegación; no sustituye a `/` |

### Deep-links de la casa (`/`)

| Query / foco | Sala o panel | Notas |
| --- | --- | --- |
| `?room=salon` | Salón | Conversación / Lía |
| `?room=music` | Música | Web Audio local |
| `?room=lab` | Laboratorio | Fuentes y contraste |
| `?room=games` | Taller de mundos | Planes 3D |
| `?room=cinema` | Cine | Vídeo local |
| `?room=constellation` | Constelación | Ícaro / Alba |
| `?room=mind` | Mente | Memoria / archivo |
| `?room=body` | Cuerpo de Ion | Herramientas |
| `?room=refutation` | Refutación | Candidatas |
| `?room=language` | LOR-ΩΣ | Lenguaje |

Los IDs de sala deben coincidir con `HOUSE_ROOMS` / `ROOM_IDS`. Un `room` desconocido no debe inventar una sala.

## API routes (App Router)

| Ruta | Clase | Propósito | Auth / límites |
| --- | --- | --- | --- |
| `/api/cloud/status` | api | Estado del puente + telemetría de procesos para la casa | Pública acotada; sin secretos |
| `/api/cloud/bridge` | api | Cola saliente PC ↔ Sites (claim/heartbeat/complete) | Token de puente; no expuesto al navegador |
| `/api/cloud/chat` | api | Mensajes de chat cloud | Usuario ChatGPT / sesión |
| `/api/cloud/conversations` | api | Listado de conversaciones | Usuario |
| `/api/cloud/conversations/[id]` | api | Conversación concreta | Usuario + aislamiento |
| `/api/cloud/jobs/[id]` | api | Estado de trabajo encolado | Usuario / lease |
| `/api/cloud/artifacts/[id]` | api | Artefactos (p. ej. vídeo) | Auth + lease |
| `/api/house/memory` | api | Observaciones de puesto (solo terminales reportados) | Lectura; sin escritura de cliente |
| `/api/agent-mirror` | api | Espejo de fichas de agentes públicos | Acotado |
| `/api/chat` | api | Chat del workspace legacy/origen | Según sesión |
| `/api/state` | api | Estado del workspace legacy | Según sesión |
| `/api/status` | api | Estado genérico / salud UI | Pública acotada |
| `/api/autonomy` | api | Encolar revisión autónoma (vía coordinador) | No implica mejora aceptada |
| `/api/spiral` | api | Estado / control de espiral expuesto | No inventa experiencias |
| `/api/lab` | api | Laboratorio / ensayos | Acotado |
| `/api/studio` | api | Estudio creativo / proyectos | Usuario |
| `/api/mission` | api | Misión / objetivos expuestos | No acredita cumplimiento |
| `/api/archive` | api | Archivo | Lectura acotada |
| `/api/technical-reading` | api | Lectura técnica / paneles | Acotado |
| `/api/web` | api | Utilidades web | Acotado |
| `/api/cloud/evidence` | api | **Esqueleto** de evidencia tipada (contrato v1) | Lectura; vacío = unknown |

## Reglas de coherencia

1. Ninguna página de producto puede afirmar «mejora integrada» sin un registro de evidencia válido del servidor (`docs/PROCESS_TELEMETRY_CONTRACT.md` y `cloud/lib/evidence-contract.ts`).
2. `/` es el hogar canónico de Lía; `/origen/` es legacy y no debe ser el destino por defecto del branding.
3. Las APIs no deben filtrar memoria privada del PC ni controles arbitrarios en sesiones compartidas.
4. Si una ruta carece de backend operativo, la UI muestra **unknown / en espera**, no éxito.
5. Añadir una ruta nueva exige actualizar este inventario en el mismo cambio.

## Relación con habitantes y procesos

Los 24 habitantes viven en `/` (ver `docs/CHARACTER_CATALOG.md`). Los procesos (`chat`, `experience`, `tools`, …) no son rutas HTTP; se reflejan solo vía telemetría de `/api/cloud/status`.

## Pendiente (no inventado aquí)

- Estado operativo por residente (activo / en espera / decorativo) enlazado a telemetría en tiempo real en documentación viva.
- Publicación Sites de esta revisión (sigue siendo un paso de despliegue distinto de GitHub).
