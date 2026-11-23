# ERAS en el cuerpo de Lía

ERAS es la base gráfica canónica de Ion, el cuerpo operativo de Lía. Surgió del juego de épocas, pero su función dentro de Lía es proporcionar el motor con el que los constructores materializan y revisan sus proyectos. Atlas aporta el encargo y los datos de la escena; la vista ERAS los transforma en mallas, materiales, iluminación y cámara.

La vista de proyectos carga el motor desde `/eras-engine/index.html`, en el mismo origen de Atlas. Sus módulos `render-engine.js`, `gpu-renderer.js`, `graphics.js`, `cinematography.js` y las dependencias Three son copias exactas de una revisión registrada de ERAS. `public/eras-engine/provenance.json` conserva el proyecto de origen, commit, rutas y SHA-256. El adaptador y el controlador de la vista son código específico de integración de Atlas. Esta distribución versionada evita afirmar que los dos sitios se sincronizan automáticamente sin comprobarlo.

## Entrada de los constructores

La vista acepta exclusivamente documentos de escena validados: objetos, materiales, semiejes, transformaciones, cámara, iluminación y cielo. No acepta JavaScript, HTML, shaders, URLs de texturas ni rutas de importación propuestas por un modelo. El límite del adaptador es de 256 objetos y 32 materiales; el generador actual conserva su propio límite más pequeño.

Los proyectos gráficos se muestran con el motor real de ERAS: WebGPU cuando el navegador logra iniciarlo y WebGL2 compatible en otro caso, materiales físicos, sombras, entorno luminoso y el tratamiento cinematográfico existente. Órbita, desplazamiento y zoom actúan sobre la cámara real. El píxel relativo se limita a 1,5 y puede reducirse durante interacción lenta. No se presenta WebGPU como activo si el backend real es WebGL2.

Los mensajes se aceptan solamente del padre del iframe y del mismo origen. La escena anterior se conserva si los datos o el primer render de una sustitución fallan. La vista nueva es una inspección gráfica; no sustituye el sistema de partida del juego ni implementa automáticamente sus misiones, combate o controles.

## Mantener una sola base canónica

Comprobar sin modificar:

```sh
node scripts/sync-eras-engine.mjs --check
```

Sincronizar una revisión limpia y confirmada de ERAS:

```sh
node scripts/sync-eras-engine.mjs --write --source /workspace/sites/eras
node scripts/sync-eras-engine.mjs --check --source /workspace/sites/eras
```

La escritura afecta solamente a los 17 archivos del inventario fijo y al manifiesto. No sustituye el adaptador, el controlador, la página ni las escenas del usuario. Rechaza fuentes modificadas, archivos no versionados y enlaces simbólicos. Antes de publicar hay que ejecutar las pruebas y reconstruir Atlas desde el commit exacto que se vaya a subir.

En una copia independiente de `cloud/` en GitHub puede faltar el repositorio hermano de ERAS. En ese caso la comprobación verifica solamente el inventario y sus hashes locales, y lo indica en su resultado. No acredita que se haya comprobado el origen remoto.

## Qué se ha comprobado

Las pruebas CPU construyen geometría y materiales Three reales, comprueban semiejes, presupuestos, conservación de escenas, aislamiento de mensajes y procedencia de módulos. Las pruebas del controlador sustituyen únicamente las fronteras DOM/GPU y verifican carga, error de render, cámara, captura, pausa y liberación de recursos. Una ejecución CPU no demuestra calidad visual, velocidad GPU ni equivalencia con un servicio de generación de imágenes o vídeo.

El código heredado de ERAS ofrece exportación OpenUSD para Omniverse. Esa exportación no constituye una sesión Omniverse/RTX conectada. Este adaptador tampoco añade inferencia neuronal, una GPU de servidor ni credenciales para servicios externos. La apariencia y rendimiento finales siguen necesitando inspección en un navegador con capacidad gráfica.
