# STL de escena y revisión de impresión

El taller 3D permite exportar la geometría de una escena como **ASCII STL** desde el botón `STL`. El archivo contiene triángulos, normales de faceta y las dimensiones de la escena en unidades de escena (`1` = una unidad, sin conversión a milímetros).

## Qué exporta

- Los objetos `box` y `sphere` que forman la escena procedural.
- La rotación en Y, la escala y la posición de cada objeto.
- Un recuento de triángulos y los límites mínimos/máximos que el taller muestra al terminar.

No incluye el suelo auxiliar que se añade al glTF, ni patrones de shader, luces o lógica de juego.

## Qué no es

No es un cuerpo, un modelo anatómico, una malla estanca ni una pieza validada para fabricación. La exportación no comprueba:

- estanqueidad o errores de manifold;
- grosor mínimo de pared;
- soportes, voladizos o orientación;
- tolerancias, escala física o unidades del laminador;
- resistencia, materiales, biocompatibilidad o seguridad;
- ningún estado de una impresora real.

Tampoco hay una impresora conectada, una cola de fabricación ni una autorización física.

## Antes de imprimir

1. Abrir el STL en un laminador y comprobar la escala. Convertir las unidades de escena a milímetros de forma deliberada.
2. Revisar la malla: agujeros, caras invertidas, geometría degenerada y piezas sueltas.
3. Definir material, orientación, paredes, relleno y soportes.
4. Imprimir primero una prueba pequeña y revisar la pieza fuera de la máquina.
5. Para cualquier cuerpo de Lía, aplicar autorización humana, límites de fuerza, parada de emergencia y pruebas supervisadas antes de acercarlo a una persona.

El código vive en [`cloud/lib/studio/stl.ts`](../cloud/lib/studio/stl.ts) y las pruebas en [`cloud/tests/atlas-stl.test.mts`](../cloud/tests/atlas-stl.test.mts).
