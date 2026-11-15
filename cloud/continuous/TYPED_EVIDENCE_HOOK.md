# Evidencia tipada desde la auditoría local

## Flujo automático (recomendado)

1. `reviewCapabilities` adjunta `typedEvidence` al informe (`autonomous-review.mjs` + `typed-evidence-from-report.mjs`). **Nunca** inventa `integratedRevision`.
2. El historial se guarda en `data/autonomous-review.json`.
3. El **puente** (`atlas-cloud-bridge.mjs`), en cada tick, lee el último informe; si `report.at` es nuevo, llama a `publishReportEvidence`:
   - escribe `data/typed-evidence.json`
   - POST autenticado a `/api/cloud/evidence` en Sites
4. `/actividad/` lee el almacén efímero y muestra unknown si está vacío.

## CLI manual

```bash
node continuous/publish-report-evidence.mjs
```

## Enganche opcional en `service.mjs`

No es obligatorio si el puente está en marcha. Si quieres publicar en el mismo proceso del coordinador:

```js
import {publishReportEvidence} from './publish-report-evidence.mjs';
// tras event('autonomous_review', ...)
void publishReportEvidence(report).then(result=>{
  if(result.published)event('typed_evidence','Evidencia tipada publicada',result);
}).catch(()=>{});
```
