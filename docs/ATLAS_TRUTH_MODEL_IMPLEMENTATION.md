## Implementación incremental del estado de evidencia

`cloud/public/house/process-evidence.js` añade un clasificador puro para distinguir evidencia ausente, telemetría en espera, señal caducada y estado reportado por el coordinador. La salida mantiene siempre `verified: false` e `integrated: false`: esta función no tiene acceso a validación independiente ni a pruebas posteriores de integración. Los contadores tampoco se convierten en afirmaciones de aprendizaje.

La cobertura está en `cloud/lib/house/process-evidence.test.mjs` e incluye estados reportados, ausencia, desconexión, caducidad, fecha futura y límites de inferencia. Este primer cambio de código no conecta todavía el clasificador a la UI de la casa; hacerlo requiere una integración revisada de `atlas-house.tsx` y QA de la aplicación.
