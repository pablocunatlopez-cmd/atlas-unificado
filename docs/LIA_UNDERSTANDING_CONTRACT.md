# Lía — contrato de comprensión, memoria y evidencia

La identidad compartida está definida en `cloud/public/house/lia-identity.js`. El módulo `cloud/public/house/lia-understanding.js` establece un contrato puro para clasificar registros sin ejecutar modelos ni realizar acciones.

| Fuente declarada | Vértice | Componente | Precaución |
| --- | --- | --- | --- |
| `memory` | Mental | Atlas | Un recuerdo puede ser incorrecto o estar desactualizado |
| `observation` | Físico | Ion | Un dato observado necesita comprobar fuente, contexto y frescura |
| `unknown` | Dios/Suceso | Constelación | Lo desconocido no equivale a falso, imposible ni sobrenatural |

El campo `evidenceStatus` distingue ausencia de pruebas de pruebas suministradas pero **no verificadas**. El módulo no certifica la verdad de una afirmación.

## Integración todavía pendiente
1. Adaptar el backend de conversación y memoria para que use este contrato sin reinterpretar automáticamente la procedencia de cada dato.
2. Añadir referencias verificables, vigencia temporal, contradicciones, permisos y correcciones del usuario.
3. Presentar en las respuestas de Lía una separación clara entre conocimiento, observación e incertidumbre.
4. Validar las integraciones con pruebas y revisión humana antes de habilitar migraciones o escrituras de memoria.

No se ha conectado todavía el contrato al almacenamiento persistente ni a la inferencia de chat. No hay migración ni ejecución autónoma.
