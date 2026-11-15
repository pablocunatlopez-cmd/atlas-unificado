# STL de escena, escala y revisión de malla

El taller 3D permite exportar la geometría de una escena como **ASCII STL** desde el botón `STL`. Antes de descargar, muestra un informe de la malla y bloquea la descarga si encuentra errores de malla.

## Escala y unidades

El STL no tiene metadatos de unidad. El taller aplica una escala explícita de **milímetros por unidad** (por defecto `1`) y escribe las coordenadas ya convertidas a milímetros. El nombre del sólido es `atlas_scene_mm`.

El panel **Propiedades** permite cambiar:

- **Escala de impresión (mm/unidad):** convierte las unidades de la escena a milímetros.
- **Grosor mínimo orientativo (mm):** umbral para avisar de piezas finas. Por defecto, `1.2 mm`.

## Qué comprueba

- **Cierre topológico:** cada arista debe pertenecer exactamente a dos caras. Se informan aristas abiertas y aristas con más de dos caras.
- **Triángulos degenerados:** triángulos con área cero.
- **Grosor local:** lanza rayos desde una muestra de caras hacia el interior y mide la distancia al otro lado del sólido. Es una estimación del **grosor del sólido**, no del grosor de pared que configura el laminador.
- **Solapamientos:** avisa cuando dos cuerpos comparten volumen; cada malla puede estar cerrada, pero la unión no es un sólido único.
- **Cuerpos separados:** una escena con varias piezas no es una pieza única.
- **Escala y umbral:** rechaza valores no finitos, cero o negativos.

Los errores topológicos bloquean la descarga. Los avisos de grosor, solapamiento o múltiples cuerpos permiten descargar, pero quedan visibles en el informe.

## Qué no es

No es un cuerpo, un modelo anatómico, una certificación de fabricación ni una pieza validada por un laminador. La revisión no comprueba:

- resistencia, materiales, biocompatibilidad ni seguridad;
- soportes, voladizos, orientación o tolerancias;
- si el laminador aplica el grosor de pared, relleno o compensación adecuados;
- ningún estado de una impresora real.

Tampoco hay una impresora conectada, una cola de fabricación ni una autorización física.

## Antes de imprimir

1. Abrir el STL en un laminador y comprobar la escala en milímetros.
2. Revisar agujeros, caras invertidas, piezas sueltas y solapamientos.
3. Definir material, orientación, paredes, relleno y soportes.
4. Imprimir primero una prueba pequeña y revisar la pieza fuera de la máquina.
5. Para cualquier cuerpo de Lía, aplicar autorización humana, límites de fuerza, parada de emergencia y pruebas supervisadas antes de acercarlo a una persona.

La esfera usa un solo vértice en cada polo para evitar triángulos degenerados y mantener el cierre topológico.

El código vive en [`cloud/lib/studio/stl.ts`](../cloud/lib/studio/stl.ts) y las pruebas en [`cloud/tests/atlas-stl.test.mts`](../cloud/tests/atlas-stl.test.mts).
