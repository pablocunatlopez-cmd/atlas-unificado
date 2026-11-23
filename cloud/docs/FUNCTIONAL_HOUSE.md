# La casa como interfaz funcional de Lía

Todo componente nuevo debe justificar su utilidad, sus datos o acción ejecutable y su relación con otros componentes. Una forma o una descripción no acreditan que exista esa función. Atlas piensa, Ion construye con ERAS e Ícaro conecta conocimiento; el resultado debe beneficiar a Lía.

## Primer recorrido implementado

- Archivo de Mente: el armario existente abre memorias `room:mind`, con lectura y escritura sobre el estado autenticado de la persona.
- Archivo de diseños: el segundo armario abre memorias `module:workshop`. Crear desde ese ámbito lo selecciona por defecto; la persona puede cambiarlo explícitamente.
- Construir con ERAS: el puesto existente de Ion abre el taller `/eras`, con proyectos y encargos de geometría existentes.
- Los tres elementos tienen enlaces entre sí, se pueden abrir pulsando el mobiliario o desde los botones accesibles de su sala.
- Al solicitar una escena o juego, el Worker recupera notas generales y del taller del mismo usuario, selecciona las vigentes y relevantes y las aporta al modelo como datos atribuidos. No envía estas notas a búsquedas públicas. El chat general continúa excluyendo las memorias del taller y de Mente. El archivo de Mente todavía no alimenta el constructor: su conexión actual es de navegación.

La información conserva la persistencia D1, el aislamiento de usuario y el control de revisión existentes. Abrir un armario no consume inferencia; generar una escena usa el encargo ya existente, sin una llamada adicional. Una nota es contexto para el diseño, no garantía de cumplimiento: la salida sigue necesitando validación geométrica y revisión visual.

## Contrato y límites

`public/house/functional-world.js` es el catálogo cerrado de funciones implementadas. Sus vínculos deben resolver destinos existentes. El validador de intención exige el ámbito exacto de un armario. Para escaleras exige zonas útiles a distinta altura y un recorrido vertical implementado. La casa actual tiene un nivel: no se ha añadido una escalera ni una planta ficticia.

El catálogo es el primer tramo de la conversión funcional del mobiliario. Los demás objetos existentes aún no están todos conectados, y los proyectos geométricos generados no adquieren por sí solos estas funciones ni pueden instalar acciones arbitrarias en la casa. Para ampliar el catálogo hay que implementar primero el almacenamiento, herramienta o navegación correspondiente y probar su conexión.

## Verificación

Pruebas con la geometría Three.js real comprueban el raycast de los armarios, sus ámbitos y los enlaces. Las pruebas del Worker ejecutan el flujo de producción con SQLite y transporte de modelo simulado: el propietario recibe sus notas de diseño, otro usuario no se filtra, el chat no recibe el archivo de diseños y se mantiene una sola llamada de modelo. También se comprueba el presupuesto de contexto sin cortar registros JSON. Se ejecutan los controles de tipos y compilación de producción. No se ha realizado una inspección visual GPU ni una escritura mediante el navegador en este entorno.

## Ampliación: superficies, herramientas y prototipo jugable

La casa añade mapas procedurales deterministas de color, normal y rugosidad para roble, yeso, tejido y piedra; color en sRGB y datos físicos sin conversión de color. Las coordenadas de textura mantienen escala en el mundo al combinar mallas. El mobiliario próximo incorpora biseles acotados y el vidrio usa transmisión, grosor e índice de refracción. Un campo HDR generado localmente se filtra con PMREM para los reflejos; la luz de entorno no es iluminación global trazada. Se conservan WebGL2, las sombras y la reducción de resolución/personajes cuando las medidas de FPS lo requieren. En escritorio el techo inicial de resolución sube a 2; en táctil se mantiene 1,35 y un mapa de sombras menor. No hay un motor WebGPU de casa conectado.

El catálogo pasa de tres a doce funciones: piano, mezclador, pantalla de cine, maqueta, mesa de investigación, observatorio, mesa de contraste, símbolos y centro de conversación se enlazan a herramientas existentes. Cada función tiene un habitante responsable. Las piezas estáticas construidas por el generador conservan referencias de código, ámbito, responsable y funciones de la sala; siguen combinadas por material. Esta trazabilidad no convierte cada pieza ornamental en una herramienta independiente ni acredita que el motor haya aprendido a programarse.

Los perfiles iniciales de habitantes se comparten entre la espiral y los talleres. Sus reglas/preferencias vigentes pueden guardarse en el ámbito `resident:<id>` mediante la memoria autenticada existente. Los encargos de escenas/juegos incorporan los perfiles y hasta dos criterios de Talo, Zuri e Ion del mismo usuario, además del archivo de diseños. No se mezclan las memorias de otros personajes ni se añaden llamadas de modelo. El resto de perfiles se muestra y puede desarrollarse, pero su integración en decisiones de música/vídeo queda pendiente.

`/jugar/casa` reutiliza la misma arquitectura, avatares, controles, colisiones y catálogo de objetos de la casa. Un contrato de misión exige cuatro acciones ordenadas y conserva inventario de la sesión: archivo → especialista → contraste → integración en Lía. El encargo selecciona una variante de música, cine o construcción. No es la generación libre de un nuevo videojuego: es una base concreta jugable y reutilizable. El chat enlaza directamente esta base cuando se le pide crear un juego de casa/Lía, sin gastar inferencia; los otros encargos mantienen su generador. El prototipo no ejecuta el bucle de trabajo ni carga instalaciones cambiantes ni escribe las memorias personales. Sus diálogos son guionizados con el perfil y criterios guardados; no simulan una consulta de IA.

Las pruebas comprueban canales PBR, repetición y determinismo de mapas, valores HDR finitos, dimensiones de biseles, acceso navegable a los doce puestos, etapas e inventario de las tres variantes, aislamiento de perfiles y transporte al modelo sin llamadas adicionales. Sigue pendiente la inspección visual GPU, el rendimiento medido en un dispositivo y la prueba de interacción de navegador. Estas mejoras técnicas no acreditan por sí solas hiperrealismo.

La pantalla de cine conserva el contrato de instrumento con `workspace:cinema`, el enlace al archivo de diseños y a Ion, y un volumen de interacción ajustado a la pantalla. La prueba del componente React comprueba que abre CinemaPanel con la API viva de la casa, sin iframe ni grabación automática; también mantiene las vistas originales de los otros puestos.
