# Auditoría inicial de línea base frontend

**Fecha de revisión:** 14 de noviembre de 2026  
**Alcance:** inspección estática de archivos y revisiones GitHub. No se ejecutó build, typecheck, pruebas ni QA en navegador; esto no es una auditoría de ejecución.

## Hallazgos comprobables

### 1. La hoja global actual es mucho más corta que la revisión padre

En `main`, `cloud/app/globals.css` contiene 74 líneas: tokens globales, resets, accesibilidad básica y `.app-shell` / `.sr-only`. La revisión padre `53b37e2ee371f7efde707e68e76006e7b60aaa37` contiene una hoja global sustancialmente más amplia, con estilos para espacios de trabajo, investigación, estudio y medios responsivos. El commit `887da9492a5f091e22e3af2dd3d545fe1a8d3b3e` sustituyó ese contenido por la hoja corta.

Esto coincide con la alerta P0 en [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md), que pide recuperar la hoja completa desde el historial conocido como bueno. **No se restaura desde esta auditoría:** antes hay que comparar dependencias de estilos actuales, confirmar qué revisión histórica conserva las secciones necesarias y probar las rutas. No conviene pegar una versión antigua a ciegas porque pueden haber cambiado componentes o selectores.

### 2. La UI de la casa contiene afirmaciones más fuertes que la evidencia descrita

En `cloud/app/atlas-house.tsx` aparecen textos que requieren revisión semántica:

- “Mientras el juego está abierto, cada vértice cumple su función”. Que la casa esté abierta no demuestra que todos los roles estén trabajando.
- “Lía se vuelve mejor” puede entenderse como una afirmación general de progreso, aunque la telemetría y los cambios sean locales y limitados.
- La etiqueta “Intervención 3D integrada en Lía” se activa cuando el componente recibe una `HouseInstallation`. El contrato de `HouseInstallation` incluye `applied: true`, pero también `renderVerified: false`; la instalación geométrica no afirma por sí sola aprendizaje (`learningChange: false` en los metadatos de escena), validación visual ni mejora general. “Integrada en Lía” es, por tanto, más fuerte y más ambigua que la evidencia disponible.

El flujo de creación público valida un plan geométrico y lo reconstruye como geometría en la escena. El código de `creative-installation.js` llama `applied` a esa aplicación en la escena, conserva procedencia y declara explícitamente `renderVerified: false` y `learningChange: false`. Esto es evidencia de una **intervención geométrica aplicada al render de la casa**, no de una mejora persistente de Lía ni de una verificación visual independiente.

La UI debe conservar ese alcance. Redacción recomendada: **“Plan 3D aplicado a la escena · render no verificado”**. Para procesos, usar **“señal reciente del coordinador”** en vez de presentar la escena abierta como prueba de que cada vértice trabaja.

### 3. La telemetría distingue actividad reportada de resultado verificado

`cloud/public/house/process-state.js` normaliza estados y descarta campos fuera del contrato. Su comentario y etiquetas aclaran que `running`, `passed` y `failed` son resultados reportados por el coordinador, no evidencia independiente ni integración. `workVerified` solo indica que se recibió telemetría reciente de una tarea en ejecución; no verifica el resultado ni el artefacto. `measuredChanges` devuelve un contador reportado vigente, no demuestra por sí mismo calidad o mejora general.

Esto es una distinción útil ya presente en el código y en [`process-state.test.mjs`](../cloud/lib/house/process-state.test.mjs). No se debe reemplazar ese comportamiento por una etiqueta genérica de “verificado”.

### 4. La identidad y el catálogo deben seguir sincronizados

[`ATLAS_CHARACTER_CATALOG.md`](ATLAS_CHARACTER_CATALOG.md) registra las identidades del catálogo de residentes y diferencia las propuestas conceptuales. La UI de la casa mantiene textos propios sobre Atlas, Ion, Ícaro y Lía. Al modificar esos textos, conservar la distinción entre identidad del producto, función declarada y proceso realmente observado.

## Siguiente trabajo recomendado

1. Recuperar e inspeccionar el diff completo de `globals.css` entre `53b37e2` y `887da94`; comparar los estilos usados por las rutas actuales antes de restaurar.
2. Mantener el contrato de `HouseInstallation` acotado: muestra geometría aplicada a la escena, no render verificado, aprendizaje ni mejora general. Ajustar la etiqueta visible a “Plan 3D aplicado a la escena · render no verificado”.
3. Ajustar el texto del espejo para distinguir señal reciente, estado reportado y resultado verificado; no inferir actividad por el mero hecho de abrir la casa ni progreso general por un contador.
4. Ejecutar typecheck y build de Cloud, pruebas de casa/telemetría/creación y QA visual de inicio, chat, actividad, taller, música, vídeo, investigación y espacios históricos.
5. Registrar comandos y resultados; marcar como desconocido cualquier chequeo que no se ejecute.

## Fuentes de revisión

- [`cloud/app/globals.css` en `main`](https://github.com/pablocunatlopez-cmd/atlas-unificado/blob/main/cloud/app/globals.css)
- [`cloud/app/globals.css` en `53b37e2`](https://github.com/pablocunatlopez-cmd/atlas-unificado/blob/53b37e2ee371f7efde707e68e76006e7b60aaa37/cloud/app/globals.css)
- [`cloud/app/atlas-house.tsx` en `main`](https://github.com/pablocunatlopez-cmd/atlas-unificado/blob/main/cloud/app/atlas-house.tsx)
- [`cloud/public/house/process-state.js`](../cloud/public/house/process-state.js)
- [`cloud/public/house/creative-installation.js`](../cloud/public/house/creative-installation.js)
- [`cloud/lib/house/process-state.test.mjs`](../cloud/lib/house/process-state.test.mjs)
- [`docs/IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md)
- [`docs/ATLAS_EXCELLENCE_PLAN.md`](ATLAS_EXCELLENCE_PLAN.md)
