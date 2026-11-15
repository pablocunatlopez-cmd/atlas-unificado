# Auditoría técnica orientada a problemas reales — 2026-11-15

Estado: **auditoría inicial, no certificación**. Basada en README.md, package.json y scripts/test-source.mjs de main. Las demás conclusiones requieren inspección de implementación y ejecución local.

## Método obligatorio para cada subsistema

1. Inventariar código, contratos, dependencias, entradas/salidas y datos sensibles.
2. Definir un caso de uso real y un fallo reproducible.
3. Medir línea base (latencia p50/p95, éxito, memoria RAM/VRAM, consumo y errores).
4. Introducir el cambio mínimo en una rama.
5. Ejecutar pruebas unitarias, integración, adversariales y regresión; conservar resultados.
6. Comparar A/B contra la línea base. Rechazar cambios que degraden seguridad, privacidad o fiabilidad.
7. Documentar rollback y condiciones de activación. No desplegar automáticamente cambios no verificados.

## Orden de auditoría

| Prioridad | Área | Riesgo real a comprobar | Evidencia exigida |
| --- | --- | --- | --- |
| P0 | Seguridad del puente nube-PC | Sesiones cruzadas, suplantación, exposición de memoria, token filtrado | Pruebas de aislamiento por usuario, replay, caducidad y denegación |
| P0 | Ejecución de código/QuickJS | Escape del sandbox, bucles infinitos, herramientas no autorizadas | Timeouts, límites de recursos, allowlist, pruebas negativas |
| P0 | Evolución autónoma | Aceptar regresiones o cambiar reglas sin control | Baseline congelada, gates, aprobación, rollback verificable |
| P1 | Chat Qwen local | Alucinación, indisponibilidad, OOM, latencia | Evaluación de respuestas, p95, recuperación tras caída |
| P1 | LOR-ΩΣ/refutación | Confundir predicciones con hechos | Trazabilidad de evidencia, falsadores y calibración |
| P1 | Memoria | Contaminación entre usuarios, retención excesiva | Aislamiento, borrado y pruebas de persistencia |
| P1 | Coordinador Aider/smolagents/nativo | Falsos éxitos por pruebas insuficientes | Contratos externos, comparación A/B, revisión humana |
| P1 | GPU y vídeo | Contención VRAM entre Qwen y ComfyUI | Ensayos de reserva, liberación y restauración |
| P2 | Casa 3D y personajes | FPS bajo, errores táctiles, animaciones engañosas | FPS móviles, accesibilidad, indicadores de estado real |
| P2 | Música, mundos, STL, cine | Exportaciones inválidas o falsas garantías de calidad | Abrir artefactos en herramientas independientes |
| P2 | Fuentes web/documentación | Contenido malicioso y obsoleto | Procedencia, hashes, caducidad y pruebas de inyección |
| P2 | Instalación y portabilidad | Windows/Linux divergentes, dependencias ausentes | Instalación limpia y CI por plataforma |

## Hallazgos comprobables en el primer vistazo

- `package.json` fija Node >=22.20.0, QuickJS 0.32.0 y Three 0.186.1; el script `npm test` ejecuta `scripts/test-source.mjs`.
- `scripts/test-source.mjs` descubre **solo** archivos `*.test.mjs` directamente bajo `continuous/`, y añade explícitamente `continuous/studio/logic.test.mjs`. Cualquier prueba nueva anidada en otras carpetas queda fuera de la suite principal salvo inclusión manual. **Acción:** hacer descubrimiento recursivo con exclusiones justificadas y probarlo.
- El README distingue prototipos, inferencia Qwen, adaptación LoRA y artefactos creativos; no presenta esos elementos como capacidades verificadas equivalentes. Mantener esa distinción en UI y métricas.
- El README documenta que GitHub no ejecuta el modelo local y que el PC/puente deben estar activos. **Acción:** medir desconexión, reintentos y recuperación sin duplicar solicitudes.

## Criterios de aceptación de una mejora

- Reproducibilidad: comando, plataforma, versión y datos sintéticos.
- Seguridad: ningún permiso nuevo implícito, ningún secreto en Git, no abrir puerto administrativo a Internet.
- Métrica: mejora cuantificable o corrección de un fallo demostrado.
- Pruebas: pasan las relevantes y se documenta qué no pudo ejecutarse.
- Reversibilidad: rama, commit y procedimiento de rollback.
- Transparencia: marcar explícitamente «propuesto», «implementado», «probado» o «desplegado».

## Primeras tareas

1. Corregir descubrimiento de tests para que una suite anidada no desaparezca silenciosamente.
2. Auditar autenticación, autorización, aislamiento y reintentos de cloud-bridge.
3. Mapear todas las rutas de ejecución de código y los límites efectivos de QuickJS.
4. Diseñar un benchmark fijo de 20 tareas reales, con fallos intencionados y métricas.
5. Integrar resultados en PRs pequeños; no fusionar cambios sin pruebas.
