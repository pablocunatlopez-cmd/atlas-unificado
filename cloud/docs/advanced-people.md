# Integración de personajes avanzados de ERAS en Atlas

Esta revisión integra los personajes avanzados en Atlas. El resultado del despliegue se verifica por separado; esta nota no acredita una revisión visual GPU.

## Procedencia y licencias

El origen local contrastado es ERAS, commit `43ea8968dc66c453da9c29d1ca469c91e177a2bc`, directorio `dist/`. Cada recurso de la tabla coincide byte por byte con ese repositorio; se conserva su SHA-256 para verificar copias posteriores. No se descargaron modelos nuevos para esta integración.

- Anatomía humana y recursos de superficie: MakeHuman Community / Data Collection AB / colaboradores de sus recursos originales, CC0-1.0. `assets/models/avatar/sources.json` conserva autores, URLs, transformaciones previas y hashes. `CC0-LICENSE.md` conserva la licencia original. Los modelos derivados de ERAS tienen superficies continuas, pesos y 163 huesos; piel, pelo, ojos y prendas forman partes del modelo.
- Animaciones: Universal Animation Library, Quaternius / Gonzalo Furnier, CC0-1.0. La licencia original se conserva en `assets/motion/LICENSE.txt`; el manifiesto registra fuente, hash y 17 clips adaptados a ambos esqueletos. La integración de Atlas utiliza `Idle_Loop`, `Walk_Loop` e `Interact`. Son animaciones de autor; no se atribuyen a captura de movimiento ni a generación nueva de IA.
- Three.js r180 y GLTFLoader: MIT, conservada en `vendor/THREE-LICENSE.txt`. Los dos módulos Three, GLTFLoader y BufferGeometryUtils coinciden con los de ERAS. Las únicas dependencias relativas del cargador son `three.module.js` y `BufferGeometryUtils.js`; ambas existen en la misma carpeta. No se añade SkeletonUtils: la clonación del grafo de huesos se implementa en `advanced-residents.js` y se prueba con los GLB reales.
- `motion-player.js` procede del código de ERAS con las rutas de carga adaptadas al origen local `/house/assets/motion/`; el archivo de poses y el manifiesto no se modifican.

## Comportamiento y presupuesto

Los recursos estáticos ocupan **28807573 bytes (27.47 MiB)**, aproximadamente 28 MB. El navegador no descarga todo al abrir la vista general. Se cargan un cuerpo y sus mapas por sexo al necesitar un humano cercano; las poses se sirven desde Atlas, sin consultar la web del autor durante el juego.

La ruta de detalle selecciona humanos cercanos **de pie** en la misma sala, con un máximo de dos en escritorio y uno en dispositivos de puntero grueso. Se conservan las identidades y colores de cada puesto, sus posiciones, viajes y etiquetas. Cada avatar tiene sus propios huesos y esqueleto; la geometría de su plantilla se comparte. Las figuras sentadas, robots, animales, aves y figuras lejanas mantienen la ruta instanciada anterior. Entrar en el Salón o en LOR permite acercarse a humanos que pueden utilizar el detalle; la vista general no transforma todos los cuerpos.

El modo ligero evita nuevas descargas y devuelve las figuras a su representación anterior. Las plantillas ya descargadas permanecen en caché hasta cerrar la escena para evitar recargarlas repetidamente. Los fallos de carga conservan la figura ligera; no se entra en un bucle de reintentos. La liberación de escena elimina actores, esqueletos, materiales, geometrías y mapas; las cargas que terminan después del cierre también se liberan.

Los movimientos de reposo son animación programada. Los gestos de trabajo siguen las señales reales de procesos de Atlas y no añaden aprendizaje ni cambios de pesos.

## Verificación disponible

Las cinco pruebas de `lib/house/advanced-residents.test.mjs` usan los GLB y las poses originales y comprueban selección y presupuesto, independencia de huesos, geometría compartida, aplicación de clips existentes, modo ligero, movimiento reducido, fallos y cierre durante una carga. Las regresiones de criaturas y escena también han pasado en esta implementación. La comparación SHA y las dependencias del cargador se comprobaron al escribir este documento.

No se ha hecho aquí revisión visual WebGL/GPU ni medición de FPS en un dispositivo. El tamaño, la apariencia y el rendimiento finales deben valorarse en el navegador; las comprobaciones de datos y código no sustituyen esa observación.

## Correspondencia de archivos

| Recurso relativo a `/house/` | Bytes | SHA-256 idéntico a ERAS |
|---|---:|---|
| `assets/models/avatar/CC0-LICENSE.md` | 6962 | `f6089cba01cb570a24712b41ab8a586ccd3cc5ef53dc266ca50b95c288956d2c` |
| `assets/models/avatar/braid01.png` | 2615248 | `24c0d2a639f04704734c3e38af97d110777c1b203e5a10c66a5c89563643a018` |
| `assets/models/avatar/eyebrows.png` | 89619 | `9940f7d0b1b223709a19b05156ba6f6e9e4dbdbced02d7574f4d51d72c58967b` |
| `assets/models/avatar/eyelashes.png` | 91600 | `4b69c0fff2648874460e9caf80c31413c444218a5c50afebc425aeaa65484a35` |
| `assets/models/avatar/eyes.png` | 610817 | `4659691c7295ad6206c78b003e5fd0e5f91dcd53032fa914a229bb48cabe424b` |
| `assets/models/avatar/female-normal.webp` | 19794 | `dbf860e54d725edbe484cabf7b42a40a4060fc6f1692e1be17a02aa3063742fb` |
| `assets/models/avatar/female-roughness.webp` | 79282 | `c32cf34c150a488f578a4e77064d8e25b033f3f31139128068c39a9cbde04645` |
| `assets/models/avatar/female-skin.png` | 4391156 | `b2a6ac8cd4f9febdb447368e29c76cd68410bb66e46d9dcfa2d5f75126eea8fc` |
| `assets/models/avatar/female.glb` | 6592648 | `3b51b243fb1efeffe4abab022706546955681684cdadb699d61dd266f6a097c3` |
| `assets/models/avatar/male-normal.webp` | 17104 | `ff0a7170f28e1ed57f8e9210c53662f2efe5e742c905e8f0120f8c83ca09dc95` |
| `assets/models/avatar/male-roughness.webp` | 77496 | `3ee2874bb5e1c9cd26156b8e95aa7c9a3a6db79a393dee414d096003bb0c05eb` |
| `assets/models/avatar/male-skin.png` | 3693828 | `862a26e335e958b70534cb5f0d7c47ef30ab148a56c42b3e9da969cf76f12963` |
| `assets/models/avatar/male.glb` | 6605968 | `f098db2f38a3cdac286d7c9d0bde69ee99056b082e538193c036e2a9d1ab6df6` |
| `assets/models/avatar/short02.png` | 3553543 | `47fe33831a3929567c733356dd66243116e05df2ace1f884ddca0080b728229f` |
| `assets/models/avatar/sources.json` | 2319 | `e39705a2a441511ecd2ee08194ac1d8099a2257ec57dce1421f7ce3745e24771` |
| `assets/motion/LICENSE.txt` | 431 | `86e0232ee0b7f441ca4041f3402114cab40e3df78efa0888e48cdd0c819cf7cc` |
| `assets/motion/manifest.json` | 6958 | `aad8b3f74658d4276888ad7ac19e04ef868e17299a48571580d2168834ed3e5c` |
| `assets/motion/poses.bin` | 352800 | `fcebba62c45fa708da7b3934e9f9523c7d230bdc34b6051c2280398f5f0ede7d` |
| `vendor/GLTFLoader.js` | 114744 | `2904f2823e23d5bc1d64512bf4c0d777ac44d728d47c34a9e3d48ce8ef6b761d` |
| `vendor/three.module.js` | 603113 | `c8211c69345d2e9949dc7a8ac969380497aa0600a5a8ac6a459c8cd02dd9cb8a` |
| `vendor/three.core.js` | 1403455 | `eb077d2417f61d3e6d9264c317cabc4ea35769ed6b0ab533067292a550784c20` |
| `vendor/BufferGeometryUtils.js` | 35551 | `248b3e8420bd3de805ca01845c1b0cc62aa2766f3c56bdcead265e306f8e715c` |
| `vendor/THREE-LICENSE.txt` | 1081 | `bfe119ea4fd413f5f7ca3fcd63adb0c4a073ed39daa2fe7d3e6b769e21272601` |

## Ajuste durante la ejecución

Cada intervalo activo de aproximadamente 1,2 segundos aporta los FPS reales al controlador. Tras calentamiento y tres intervalos lentos reduce primero el número de humanos detallados y después la resolución; ocho intervalos rápidos permiten recuperar calidad. El modo ligero del usuario conserva prioridad. No hace llamadas de IA ni añade hechos, entrenamiento de pesos o supuestas mejoras generales. Es adaptación del render dentro del navegador abierto.
