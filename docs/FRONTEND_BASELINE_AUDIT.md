# Auditoría inicial de línea base frontend

**Fecha de revisión:** 14 de noviembre de 2026  
**Alcance:** inspección estática de los archivos y revisiones GitHub indicados abajo. No se ejecutó el build, el typecheck, pruebas ni QA en navegador; esto no es una auditoría de ejecución.

## Hallazgos comprobables

### 1. La hoja global actual es mucho más corta que la revisión padre

En la rama `main`, `cloud/app/globals.css` contiene 74 líneas: tokens globales, resets, accesibilidad básica y `.app-shell` / `.sr-only`. La revisión padre `53b37e2ee371f7efde707e68e76006e7b60aaa37` contiene una hoja global sustancialmente más amplia, con estilos de espacios de trabajo, investigación, estudio y medios responsivos. El commit `887da9492a5f091e22e3af2dd3d545fe1a8d3b3e` sustituyó ese contenido por la hoja corta.

Esto coincide con la alerta de P0 en [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md), que pide recuperar la hoja completa desde el historial conocido como bueno. **No se restaura desde esta auditoría:** antes hay que comparar las dependencias de estilos actuales, confirmar que la revisión padre contiene las secciones necesarias y probar cada ruta. No conviene pegar una versión histórica a ciegas porque puede haber cambios posteriores de componentes o selectores.

### 2. La UI de la casa contiene afirmaciones más fuertes que la evidencia descrita

En `cloud/app/atlas-house.tsx` aparecen textos que requieren revisión semántica:

- “Mientras el juego está abierto, cada vértice cumple su función”. El código inspeccionado consulta estado del coordinador y la hoja de ruta describe telemetría y una futura sesión explícita; que la casa esté abierta no demuestra que todos los roles estén trabajando.
- “Lía se vuelve mejor” y “la casa ... solo mejora cuando las tareas reales se ejecutan y se verifican”. La segunda frase establece un requisito razonable, pero la primera puede leerse como una afirmación de resultado general. Debería expresarse como objetivo o limitarse a un cambio concreto medido.
- “Intervención 3D integrada en Lía” se muestra cuando existe `installation`. Debe comprobarse qué significa realmente ese estado en `experience-creative-preview` y si se refiere a vista previa/aplicación local o integración persistente. El texto de interfaz no debería superar el alcance del callback.

Recomendación de redacción segura: describir a la casa como espejo visual, mostrar `sin señal / en espera / reportado / validado` según telemetría y reservar “integrado” para un cambio persistente cuya aplicación haya sido confirmada.

### 3. La identidad y el catálogo deben seguir sincronizados

El documento [`ATLAS_CHARACTER_CATALOG.md`](ATLAS_CHARACTER_CATALOG.md) registra las identidades del catálogo de residentes y diferencia las propuestas conceptuales. La UI de la casa mantiene textos propios sobre Atlas, Ion, Ícaro y Lía. Al modificar esos textos, conservar la distinción entre identidad del producto, función declarada y proceso realmente observado.

## Siguiente trabajo recomendado

1. Recuperar e inspeccionar el diff completo de `globals.css` entre `53b37e2` y `887da94`; comparar los estilos usados por las rutas actuales antes de restaurar.
2. Inspeccionar el contrato y el ciclo de vida de `HouseInstallation`, `onCreativeApplied` y `readCreativePreview`; definir el significado exacto de “aplicado” e “integrado”.
3. Ajustar los textos de estado de `atlas-house.tsx` para no inferir actividad por el mero hecho de abrir la casa ni progreso general por un contador.
4. Ejecutar el typecheck y build de Cloud, pruebas de casa/telemetría/creación y QA visual de inicio, chat, actividad, taller, música, vídeo, investigación y espacios históricos.
5. Registrar los comandos y resultados; marcar como desconocido cualquier chequeo que no se ejecute.

## Fuente de revisión

- [`cloud/app/globals.css` en `main`](https://github.com/pablocunatlopez-cmd/atlas-unificado/blob/main/cloud/app/globals.css)
- [`cloud/app/globals.css` en `53b37e2`](https://github.com/pablocunatlopez-cmd/atlas-unificado/blob/53b37e2ee371f7efde707e68e76006e7b60aaa37/cloud/app/globals.css)
- [`cloud/app/atlas-house.tsx` en `main`](https://github.com/pablocunatlopez-cmd/atlas-unificado/blob/main/cloud/app/atlas-house.tsx)
- [`docs/IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md)
- [`docs/ATLAS_EXCELLENCE_PLAN.md`](ATLAS_EXCELLENCE_PLAN.md)
