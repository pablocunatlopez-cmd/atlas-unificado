# Atlas — verificación inicial del código (16-11-2026)

## Alcance y procedencia
Inspección de `AGENTS.md`, `README.md`, `package.json`, `scripts/test-source.mjs`, `docs/REAL_WORLD_AUDIT_2026-11-15.md` y `docs/ATLAS_MASTER_ROADMAP.md` en `main` (`ecb5e28a609478bf454b6b6e4c34ff1671439d1b`). No se ha ejecutado el proyecto ni sus tests. Este documento **no** certifica seguridad, rendimiento ni funcionamiento del puente.

## Hallazgos contrastados
1. **Corregir la auditoría anterior:** `scripts/test-source.mjs` **sí** recorre recursivamente `continuous/`, omite enlaces simbólicos y carpetas ocultas/node_modules, ordena los archivos `*.test.mjs` y devuelve fallo si no encuentra ninguno. La afirmación de `docs/REAL_WORLD_AUDIT_2026-11-15.md` sobre descubrimiento solo superficial está obsoleta. No reimplementar lo ya resuelto.
2. El script ejecuta `node --test --test-timeout=60000`. Verificar en CI la compatibilidad de esta opción con la versión mínima Node 22.20.0, y que la ejecución no oculte pruebas canceladas.
3. `AGENTS.md` prohíbe incluir secretos, memorias privadas y modelos en Git, atribuir falsamente resultados de modelos y exponer rutas administrativas. Son reglas documentadas; **no equivalen a verificación técnica**.
4. El roadmap reconoce pendientes críticos: validación de rutas canónicas/symlinks por host confiable, autorización vinculada a principal/diff/commit, pruebas reales del aislamiento Docker, y pruebas E2E del puente nube-PC.
5. `README.md` distingue Qwen conversacional, MLP experimental y ATLAS-LM, y aclara que GitHub no ejecuta inferencia local. Conservar estas distinciones en UI y métricas.

## Acciones priorizadas (sin asumir que son fallos explotables)
- **P0 / puente:** revisar código y tests de autenticación, aislamiento por usuario, reintentos, replay y caducidad; construir pruebas negativas con datos sintéticos.
- **P0 / agente:** auditar validación de paths, symlinks, límites de ejecución y procedencia de aprobaciones. Ningún booleano suministrado por un agente debe acreditar verificación del host.
- **P0 / CI:** obtener resultado de instalación limpia y suite completa en SHA exacto; registrar pruebas fallidas/canceladas, entorno y duración.
- **P1 / rendimiento:** establecer baseline reproducible de CPU, RAM, p50/p95 y tasa de éxito sin GPU.
- **P1 / LOR-ΩΣ:** exigir fuentes, falsadores y separación entre hipótesis, evidencia y decisiones.
- **P2 / ERAS:** medir FPS y memoria en móvil real antes de declarar mejoras visuales.

## Protocolo de aceptación
Toda modificación funcional debe tener: caso reproducible, prueba negativa, comparación con baseline, revisión del diff, rollback, y enlace a ejecución CI del commit exacto. No fusionar ni desplegar sin aprobación explícita.

## Estado
- Rama de trabajo: `audit/atlas-verification-2026-11-16`
- Documento de auditoría: **implementado**
- Ejecución de tests: **pendiente**
- Validación de seguridad: **pendiente**
- Cambios funcionales: **ninguno en esta primera entrega**
