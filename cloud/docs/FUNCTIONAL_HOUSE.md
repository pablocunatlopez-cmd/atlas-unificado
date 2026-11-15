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
