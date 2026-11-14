# Revisión de coherencia del informe de evidencia

`continuous/process-evidence-review.mjs` añade comprobaciones entre campos después de la validación estructural de `process-evidence.mjs`:

- un informe declarado como aceptado debe declarar todas las pruebas superadas y comparación `improved`;
- una decisión rechazada no puede contradecir un conjunto de pruebas superadas y mejora declarada;
- una integración reportada requiere aceptación, pruebas superadas, mejora declarada y una fecha posterior a la finalización.

Los resultados `consistent_report` e `inconsistent` siguen siendo evaluaciones de datos no confiables. No autentican al productor, no demuestran que los tests se ejecutaran y no deben representarse en la UI como `verified` o `integrated`. La revisión independiente confiable sigue pendiente.

Pruebas: `continuous/process-evidence-review.test.mjs` (incluidas automáticamente por `npm test` en la raíz).
