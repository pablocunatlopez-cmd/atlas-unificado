# Informe de evidencia de proceso — esquema inicial

El esquema inicial de evidencia para el runtime local vive en `continuous/process-evidence.mjs`. `inspectEvidenceResult()` comprueba únicamente que un informe tenga una forma acotada y coherente para pasar a revisión independiente.

## Campos requeridos

- `version: 1`;
- `taskId`, `processId`, `artifactId` con identificadores acotados;
- `artifactRevision`, hash SHA-256 del candidato;
- `completedAt`, marca de tiempo válida y no futura;
- al menos una prueba con `id`, `version` y resultado `passed` o `failed`;
- comparación con revisión base, revisión candidata, resultado declarado y motivo;
- decisión declarada (`accepted`, `rejected` o `deferred`) y motivo.

Opcionalmente, `integration` identifica la revisión destino por hash y marca de tiempo. Solo se acepta como dato coherente cuando la decisión declarada es `accepted`.

## Límite de confianza

`ready_for_review` significa únicamente «informe estructuralmente completo para revisión», no «verificado». Los campos y hashes son afirmaciones del productor; el hash identifica contenido, pero no autentica quién lo produjo ni que las pruebas se hayan ejecutado. Este validador no declara una mejora, no valida una firma y no promociona el estado a verificado o integrado. La UI no debe usar este resultado para afirmar aceptación independiente.

Para habilitar estados verificados/integrados se necesita una fuente de verificación confiable en servidor: procedencia autenticada, registro real de ejecución de pruebas, política de comparación aprobada y confirmación de la revisión integrada. Hasta implementar y probar esa capa, el estado debe permanecer reportado o en espera.

Las pruebas unitarias están en `continuous/process-evidence.test.mjs` y se ejecutan mediante `npm test` en la raíz del proyecto.
