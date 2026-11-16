# Atlas — punto real de integración con ERAS (2026-11-16)

## Arquitectura comprobada por lectura de código
- `cloud/app/atlas-house.tsx` monta `HouseScene`.
- `cloud/app/house-scene.tsx` presenta el iframe `/house/index.html` y usa mensajes `atlas:house:*` con validación de origen.
- `cloud/public/house/runtime.js` importa Three.js desde `./vendor/three.module.js`, crea la cámara PerspectiveCamera y controla el bucle de escena, navegación y gestos.
- `cloud/public/house/scene.js` exporta `buildHouse()`, que construye la escena Three.js existente.

## Integración segura propuesta (todavía NO conectada)
1. Evitar crear otro WebGLRenderer o duplicar el canvas; usar `house.scene` del runtime existente.
2. No instalar un segundo bucle de animación. El runtime llamaría a `bridge.frame(elapsedMs)` solo cuando se habilite explícitamente el modo Atlas.
3. Mantener la cámara y los controles actuales como propietarios; para activar la vista filosófica, crear un modo explícito y reversible que suspenda temporalmente la navegación habitual.
4. No pasar objetos Three.js por `postMessage`. Solo enviar comandos de navegación validados y estados JSON acotados; conservar comprobación de `origin` y `source`.
5. Los datos de `continuous/atlas-canonical-three-scene-plan.mjs` son conceptuales: transformar su escala/posición a un área segura de la casa antes de montar geometría.
6. No confundir la sala `body` (Ion) ni la sala `constellation` (Cielo/Ícaro) con los tres vértices canónicos.
7. Para integrar módulos `continuous/*.mjs` en `cloud/public/house/runtime.js` hay que decidir una estrategia de empaquetado/importación compatible con el despliegue. No añadir imports relativos a `continuous` desde `public` sin resolver esa frontera.

## Estado verificable
Se añadió `continuous/atlas-eras-house-bridge.mjs` como contrato de integración y una prueba de ciclo de vida. No se ha modificado el runtime de ERAS, no se ha montado el visor en el iframe y no existe validación de píxeles. Ningún módulo generado se ejecutó manualmente en esta fase; GitHub Actions puede ejecutar las pruebas automáticamente.
