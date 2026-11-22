# Atlas · Herramientas gratuitas y roadmap de integración (noviembre 2026)

## Principio de arquitectura
Atlas sigue siendo el coordinador. Los proveedores y agentes externos son **adaptadores opt-in**, nunca dependencias obligatorias ni servicios instalados automáticamente. No se necesitan créditos de OpenAI para el camino CPU/local. El uso de un servicio externo sí puede tener coste; evitarlo requiere comprobar la configuración y usar modelos locales.

## Herramientas priorizadas
| Herramienta | Repositorio oficial | Uso concreto | Estado Atlas |
| --- | --- | --- | --- |
| llama.cpp | https://github.com/ggml-org/llama.cpp | Inferencia GGUF CPU mediante HTTP local | Cliente, salud y demo existentes; no se instala el binario |
| whisper.cpp | https://github.com/ggml-org/whisper.cpp | Transcripción local y voz supervisada | Cliente CLI existente; sin captura de micrófono |
| Aider | https://github.com/Aider-AI/aider | Edición Git y mapas de código; alternativa manual | Registrado como herramienta opcional; sin ejecución |
| OpenCode | https://github.com/anomalyco/opencode | Patrones de agentes y herramientas | Referencia de arquitectura, sin dependencia |
| OpenHands | https://github.com/All-Hands-AI/OpenHands | Aislamiento y revisión de tareas | Referencia de arquitectura, sin dependencia |

Catálogo verificable en `continuous/atlas-free-tool-catalog.mjs` y pruebas asociadas.

## Roadmap priorizado
1. **P0: integridad y seguridad** — mantener CI, pruebas de regresión y revisión humana; puerta integrada `continuous/atlas-restore-safety-gate.mjs` (solo lectura). Pendiente: validación de identidad/roles de firmantes, anclaje externo del historial y permisos de Git.
2. **P1: inferencia CPU real** — ejecutar llama.cpp instalado por el usuario; medir RAM total del proceso llama, latencia p50/p95, tokens/s y fallos reales. No asumir que un mock demuestra rendimiento.
3. **P2: coding agent verificable** — usar mapa de repo, propuestas de parche, pruebas en sandbox y PR; Aider puede emplearse manualmente con Ollama/llama.cpp, siempre en rama aislada. Ningún cambio automático en main.
4. **P3: memoria y LOR-ΩΣ** — historial local persistente, evidencia, evaluaciones repetidas y recuperación supervisada; separar hipótesis de resultados medidos.
5. **P4: voz y UI** — conectar micrófono del host con whisper.cpp, revisión de transcripción, envío explícito y visualización de errores.
6. **P5: ERAS** — escenas, geometría y pruebas de rendimiento WebGL/Three.js en hardware real antes de prometer calidad AAA.
7. **P6: integración Sites** — desplegar solo con permisos y editor adecuados; GitHub no sincroniza automáticamente Sites.

## Uso y verificación
```bash
npm ci --ignore-scripts
npm test
node scripts/check-syntax.mjs
node continuous/atlas-cpu-demo-start.mjs
```
La demo exige que llama.cpp esté iniciado por separado en `127.0.0.1:8080`. El catálogo **no instala nada**, no descarga modelos, no abre puertos externos ni consume tokens en la nube.

## Criterios de aceptación
- Pruebas y sintaxis verdes en CI.
- Benchmark reproducible sobre equipo real y sin coste de API.
- Revisión de licencias y versiones antes de incorporar dependencias.
- Evaluación A/B sin regresiones conocidas.
- Registro de aprobación autenticado, verificación de revisión Git y confirmación humana independiente antes de restaurar o desplegar.

## Riesgos
- Herramienta gratuita no equivale a modelo gratuito: algunos agentes usan APIs comerciales si se configuran así.
- La identidad declarada de un firmante no demuestra que tenga permisos; el host debe comprobarlos.
- Un hash encadenado sin ancla externa no protege contra sustitución completa del historial.
- Los adaptadores no prueban que los ejecutables externos estén instalados ni que funcionen en el ordenador del usuario.
