# Calibración de luminancia de imagen

21 de noviembre de 2026. Misión `sense:image`, consulta pendiente `icarus-68`, encargo `work-8fe427ce-9d8c-4221-8619-9c7b4a4d0d3f`. Beneficio concreto para Lía: el instrumento de imagen deja de confundir el valor sRGB codificado con luminancia relativa lineal. No se añade visión semántica.

## Evidencia y decisión de ingeniería

La consulta 68 conservaba fuentes realmente leídas de MDN sobre ImageData y píxeles RGBA, propuesta de GPT-OSS120B y revisión completada por Qwen. Se releen esas fuentes y el código vigente. Ya existía `imageFeatures`: no se crea otro analizador ni se presenta el inventario existente como novedad. La propuesta incluía Sobel; esta intervención se concentra en el error reproducible de luminancia y conserva la diferencia media entre vecinos como energía de bordes. No se declara Sobel implementado.

Fuentes públicas leídas:

- https://developer.mozilla.org/en-US/docs/Web/API/ImageData — orden RGBA, formato y espacio de color.
- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas — disposición de píxeles, dimensiones y acceso local.
- https://www.w3.org/WAI/WCAG22/Understanding/relative-luminance.html — definición de luminancia relativa sRGB: decodificación de canales con umbral 0.04045 antes de ponderar R/G/B con 0.2126/0.7152/0.0722.

La función anterior aplicaba los pesos directamente a los canales codificados divididos por 255. Eso mide una combinación de valores codificados, no la luminancia relativa definida por W3C. El gris 128 permitía refutarla sin depender de opinión estética o de un modelo.

| Misma muestra y referencia | v59 | Candidata | Valor esperado fijo |
| --- | --- | --- | --- |
| Gris sRGB 128, luminancia relativa | 0.5019607843 | 0.2158605001 | 0.2158605001 |
| Gris sRGB 10, rama lineal | 0.0392156863 | 0.0030352698 | 0.0030352698 |
| Negro + gris 128, luminancia media | 0.2509803922 | 0.1079302501 | 0.1079302501 |

Las primeras cinco pruebas sintéticas se ejecutaron antes de editar la implementación: cuatro fallaban y una pasaba. Tras la corrección pasan las cinco sin cambiar sus referencias ni tolerancia. Se añade además el caso del límite permitido de 1024×1024 píxeles.

## Código y consumidores

- `lib/evolution/signals.ts`: tabla de 256 canales sRGB decodificados, aplicada a media, desviación, histograma de 16 intervalos y diferencias entre vecinos. Se mantienen el límite de un megapíxel, validación de dimensiones y exclusión de alfa cero. La nueva salida identifica `metric=srgb-relative-luminance/v1` y `alphaPolicy=exclude-zero-alpha`; no se reescriben artefactos antiguos ni se comparan sus cifras como si fueran la misma métrica.
- `app/atlas-evolution.tsx`: pide píxeles sRGB al canvas, conserva el análisis local y la reducción a 512 píxeles de lado, identifica la luminancia relativa y la desviación. Una imagen completamente transparente se informa como ausencia de muestra visible, no como una imagen negra medida.
- `lib/collaboration/foreground-tools.ts`: el instrumento de cuatro píxeles mantiene el mismo caso y tolerancia, pero usa la referencia lineal W3C explícita para gris 128. Sus informes identifican la nueva calibración. Esto actualiza el consumidor de la medida; no se cambia el juez del entrenador ni su baremo.

Alfa parcial sigue participando con el mismo peso que cualquier alfa no nulo, sin componer sobre un fondo. Es una medida del color almacenado de los píxeles incluidos, no de su apariencia final sobre otro color. «Contraste» es desviación estándar de luminancia; no es la razón WCAG entre texto y fondo ni una auditoría de accesibilidad. El instrumento no reconoce objetos, personas, habla o significado, ni toma imágenes del juego automáticamente. No se ha inspeccionado una captura GPU.

## Pruebas y fallo anterior conservado

- Seis pruebas nuevas: gris de referencia, ramas de transferencia y primarios, estadísticas/bordes consistentes, transparencia/alfa parcial, fronteras de fila/entrada inmutable/dimensiones inválidas y límite de un megapíxel.
- En el grupo inicial de evolución + herramientas + cinco pruebas nuevas: 17 pasan y una falla. La prueba histórica «all real rooms and residents...» aún exige 38 memorias frente al catálogo actual de 107. Se reprodujo el mismo fallo en un checkout separado de v59 (`095bcf2d1955d4ee72b46299f877363d46103986`). No se modifica, elimina ni declara superada esa prueba. Los otros cinco casos de evolución pasan, incluidos los contratos perceptivos ya existentes.
- 20 regresiones de servidor/pausas/leases/sesiones y misiones pasan; 12 regresiones de PBR, casa funcional, prototipo y cine pasan. TypeScript sin emisión pasa.

Los valores de referencia no son una puntuación artística ni una promoción del entrenador. La calibración corrige la conformidad de una herramienta numérica con una definición explícita; no acredita un aumento general de inteligencia o entrenamiento de pesos.

## Continuidad de código y actividad

La base es Atlas v59, commit `095bcf2d1955d4ee72b46299f877363d46103986`. Se inspecciona GitHub `main` en `86b08002ed57a806d3a270f362a326f3ae694dd3`, sin cambios de catálogo en ese commit; se conservan su línea y PR, sin forzar ni sobrescribir. ERAS mantiene la revisión `43ea8968dc66c453da9c29d1ca469c91e177a2bc` y sus módulos gráficos existentes. Esta misión no cambia el renderer, sus copias, recursos PBR, programas del estudio, identidades o conversación histórica.

La vuelta ordinaria `scheduled:2026-11-21T17` guardó `run.id=365a0e07-5d77-4282-842e-f52ec7809379`, consulta `icarus-71` de Ara (`eras-character:ice:scout`). Ambos modelos completaron su participación, pero la revisión rechazó el cambio de colisiones; se conserva como rechazo en consulta y memoria, sin aplicarlo ni contarlo como mejora. No se ejecutan vueltas adicionales ni inferencias para demostrar esta calibración. El presupuesto tras la vuelta es 10/60, con límite automático 48 y margen de chat intactos.
