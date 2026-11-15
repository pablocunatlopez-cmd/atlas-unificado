# Evidencia tipada desde la auditoría local

## Flujo

1. `reviewCapabilities` (`autonomous-review.mjs`) adjunta `typedEvidence` al informe con datos reales de checks/candidatos (`typed-evidence-from-report.mjs`). **Nunca** inventa `integratedRevision`.
2. Tras cada auditoría, publicar con:

```bash
node continuous/publish-report-evidence.mjs
```

Eso escribe `data/typed-evidence.json` y, si existen `data/cloud-bridge.json` + `data/cloud-bridge.key`, hace POST autenticado a `/api/cloud/evidence`.

3. Sites: `GET /api/cloud/evidence` lista el almacén efímero; la UI en `/actividad/` muestra unknown si está vacío.

## Enganche automático en `service.mjs` (una línea)

Después de guardar el historial de autonomía, añadir:

```js
import {publishReportEvidence} from './publish-report-evidence.mjs';
// ...
void publishReportEvidence(report).then(result=>{
  if(result.published)event('typed_evidence','Evidencia tipada publicada',result);
}).catch(()=>{});
```

junto a `event('autonomous_review','Auditoría local completada',...)`.

Hasta que ese enganche esté en el servicio en ejecución, usa el CLI del paso 2 tras cada revisión.
