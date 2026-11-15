# Verificación después de publicar Sites

Lista operativa. No afirma que el ciclo en vivo esté activo.

## 0. Precondiciones en el PC

1. Coordinador local escuchando en `http://127.0.0.1:8788`.
2. Puente configurado: `continuous/data/cloud-bridge.json` + `cloud-bridge.key`.
3. Código actualizado a `main` (pull en el PC).
4. Sites publicado desde el mismo `main`.

## 1. APIs públicas (sin token)

Sustituye `https://TU-SITE` por el origen real.

```bash
curl -sS "https://TU-SITE/api/cloud/evidence" | head -c 400
curl -sS "https://TU-SITE/api/cloud/session-heartbeat" | head -c 400
curl -sS "https://TU-SITE/api/cloud/status" | head -c 400
```

Esperado:

| Endpoint | Campo clave | Valor honesto si aún no hay datos |
| --- | --- | --- |
| `/api/cloud/evidence` | `evidence` | `[]` y nota de *unknown* |
| `/api/cloud/session-heartbeat` | `liveCycleEnabled` | `false` salvo que hayas puesto `ATLAS_LIVE_CYCLE_ENABLED=1` |
| `/api/cloud/status` | telemetría / online | offline o stale si el PC no late |

## 2. UI

1. Abre `/` (casa): badge de estado no debe quedar colgado > 8 s.
2. Abre `/actividad/`:
   - Panel de evidencia tipada visible.
   - Si no hay registros: **Sin evidencia tipada** (no “éxito”).
   - Opt-in de trabajo en vivo + estado de latido.
3. Con pestaña oculta, el opt-in no debe autorizar trabajo (fail-closed).

## 3. Evidencia real (PC → Sites)

Tras al menos una auditoría local (`autonomous-review.json` con historial):

```bash
cd continuous
node publish-report-evidence.mjs
```

O reinicia el **puente**: en el siguiente tick publicará un `report.at` nuevo una sola vez.

Luego:

```bash
curl -sS "https://TU-SITE/api/cloud/evidence"
```

Si el POST del puente funcionó, `evidence` deja de estar vacío. `verdict: passed` **sin** `integratedRevision` debe mostrarse como pruebas superadas, no como integración.

## 4. Activar ciclo en vivo (solo si lo decides)

**Sites / Worker**

```text
ATLAS_LIVE_CYCLE_ENABLED=1
```

**PC (opcional, endurece reviews)**

```powershell
$env:ATLAS_ENFORCE_SESSION_LIVE_WORK = "1"
```

Reinicia Sites y el puente. Comprueba:

```bash
curl -sS "https://TU-SITE/api/cloud/session-heartbeat" | grep -i liveCycle
```

`liveCycleEnabled` debe ser `true` solo entonces. Activa el interruptor en la UI con la pestaña visible.

## 5. Fallos frecuentes

| Síntoma | Causa probable |
| --- | --- |
| Evidence siempre `[]` | Sites sin el route nuevo, o puente sin publicar, o sin auditoría |
| 403 al POST evidence desde el navegador | Correcto: solo el token de puente escribe |
| `liveCycleEnabled: false` | Variable de entorno no puesta o Sites no redesplegado |
| Panel “tiempo de espera” | API lenta o ruta incorrecta |
| Review en vivo falla con enforce | Opt-in off, pestaña oculta o flag servidor off |

## 6. Qué no validar todavía

- Que Lía “mejoró” solo porque hay un registro `passed`.
- Que los 24 habitantes son agentes independientes.
- Que el store efímero de evidencia sobrevive a un cold start de Workers (no es durable).

Cuando los pasos 1–3 pasen, P2 está desplegado. El paso 4 es P3 consciente, no automático.
