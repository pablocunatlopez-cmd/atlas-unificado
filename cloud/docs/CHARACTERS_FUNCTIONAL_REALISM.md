# Personajes: detalle ligado a función

El pase anterior conservaba los modelos anatómicos de ERAS pero excluía del detalle a todos los humanos sentados. Esto mantenía figuras simples precisamente en puestos como música, memoria y laboratorio. Se habilita su representación detallada con el mismo esqueleto CC0, sin cambiar identidades ni especies.

## Cambios implementados

- Pose sentada articulada sobre los huesos reales, con muslos, tibias y pies alineados al asiento y al suelo. La pose se reconstruye en cada fotograma y no acumula deformación. Al desplazarse se usa la marcha existente; el gesto de trabajo requiere una señal real.
- Apariencia estable por `resident.id`, oficio y sala: uniforme, altura, pelo, perfil inicial y enlaces a funciones. El color de ropa ya no depende del orden de selección. Lino del atlas generado, piel con mapas físicos y ojos con reflejo corneal aproximado.
- Mirada ocular guionizada hacia una cámara cercana solo en reposo, limitada y desactivada al trabajar, moverse o reducir animaciones. No es una respuesta de modelo ni comprensión de la mirada.
- Cuatro mallas anatómicas CC0 de uso compartido representan a los diez humanos en modo ligero, con variantes de pie y sentadas. Los catorce robots, animales y aves usan mallas procedurales articuladas. Al cargarse correctamente, estas mallas sustituyen las figuras de emergencia. La luminosidad y los gestos de trabajo conservan su vínculo con las señales verificadas.
- Movimiento reducido conserva una pose estática y el estado real del puesto, en ambos niveles de detalle.
- Los 24 habitantes se pueden consultar por clic o E. Sus volúmenes de interacción siguen la posición real, incluso en los viajes de Sigma. La ficha abre su oficio, herramienta y criterios guardados. Los seis críticos del cine tienen roles explícitos; estar presentes no significa que estén ejecutando un modelo.

Los residentes no sustituyen las acciones de los objetos ni entregan inventario del prototipo. Distancia de cámara y jugador, transiciones y paredes impiden consultas a distancia o a través de muros. El mapa mantiene sus usos de navegación.

## Recursos y verificación

Se reutilizan los GLB, animaciones y mapas CC0 cuya integridad se ha comprobado, y el atlas generado dentro de ChatGPT. No se han añadido modelos remotos, inferencias, otro proveedor ni un chat independiente por personaje. La geometría compartida, esqueletos propios y liberación de materiales se conservan. El límite adaptativo sigue siendo dos humanos próximos en escritorio y uno en móvil; los demás mantienen representación ligera.

La ficha de cada humano abre un primer plano con su malla articulada y mapas de color y relieve de 4096 × 4096. Los mapas conservan las UV existentes y combinan las texturas CC0 remuestreadas con microporos generados a resolución completa. El archivo `public/house/assets/models/ultra/provenance.json` registra sus fuentes y hashes. ERAS carga el detalle de un solo humano a petición y libera los mapas al salir. La captura requiere un lienzo WebGL capaz de generar los 3840 × 2160 píxeles del PNG.

Pruebas CPU con modelos y animaciones reales comprueban postura, pies, ausencia de deriva, materiales, aparición por ID, transiciones y recursos. Raycast y handlers reales comprueban acceso a los 24 personajes, viajes y restricciones de interacción. Se comprueban parámetros PBR, señales verificadas y movimiento reducido. También se ejecutan tipos y compilación.

No se ha observado la escena en una GPU. La respuesta final de materiales, expresiones, comodidad y rendimiento requiere revisión visual; este pase acerca el mundo al objetivo de realismo sin declararlo alcanzado.

La piel conserva el albedo y las coordenadas UV originales. Un canal procedural de microdetalle añade variación muy pequeña y acotada de normal/rugosidad sobre los mapas anatómicos existentes, sin desplazar rasgos faciales. Se mantiene la resolución original y la orientación de textura; si la preparación opcional falla se usan los mapas originales. Su prueba comprueba que la dirección anatómica cambia menos de lo permitido y que no se modifican las entradas.
