# Integración del ZIP y continuidad de Lía

## Fuentes comprobadas

El ZIP `atlas-unificado-main` coincide con GitHub `86b08002ed57a806d3a270f362a326f3ae694dd3`. Se conserva esa base y se integra con la rama de Sites hasta `1b11dca`, que incluye correcciones de estadísticas, presupuestos de contexto, reproducción de solicitudes y evidencia de repositorio. No se ha leído una conversación de Gemini: el enlace solo devolvió la pantalla de acceso. No se atribuyen a Gemini cambios que no se hayan recuperado.

La arquitectura vigente es Atlas como mente, Ion como cuerpo con ERAS e Ícaro como cielo/constelación. Lía es el objetivo común. Los módulos originales del ZIP se conservan con procedencia en `lib/lia/provenance.json`. Se adaptan al despliegue autocontenido de Sites; no se inicia el coordinador del PC.

## Correcciones funcionales

- Un encargo directo y único de escena, juego, partitura o dirección de vídeo desde el chat ejecuta la herramienta correspondiente. Preguntas informativas, negaciones y encargos ambiguos siguen siendo conversación. Un guion no se presenta como vídeo ya grabado.
- Las creaciones se guardan para el propietario y se abren por su identificador, sin reproducción o grabación automática. La música y el cine reciben sus perfiles iniciales y criterios vigentes, separados de otros ámbitos y usuarios.
- El taller reutiliza el identificador tras perder una respuesta de red. Una cancelación pendiente bloquea otro encargo; los resultados antiguos no sustituyen el proyecto abierto. Un fallo terminal permite un intento nuevo explícito.
- Los encargos creativos de más de 4.000 caracteres se rechazan antes de insertar o gastar inferencia; el chat normal conserva su límite de 6.000.
- Una salida geométrica inválida dispone de una corrección, con comprobación de navegación y tiempo reservado para compilar. No hay reintentos automáticos por cuota, red o credenciales. Cancelación o caducidad durante la compilación impiden publicar resultados tardíos.
- Los informes de integración superados y los trabajos pendientes llegan al contexto de Lía. Un reporte no cierra por semejanza el trabajo de otro especialista ni equivale a verificación independiente.
- La cuota de obras vivas utiliza una misma fecha para leer y evaluar el presupuesto. La pausa o falta de margen para autor, reparación y revisor conserva la candidata en espera, sin consumir otra consulta.

## Integraciones del ZIP

El mapa de la tríada se abre dentro de la escena existente. Sus vértices conducen a Mente, Ion y Constelación; al salir se recupera la vista anterior. No crea otro renderer, otro bucle ni un agente por cada espiral. Se conservan materiales PBR, avatares, controles, doce puestos funcionales y el prototipo de la casa.

`/lia-world` proyecta el historial canónico autenticado y sus trabajos. Distingue hipótesis aportadas, cambios de estado, referencias y cadenas de integridad verificadas. Un hash íntegro no demuestra la verdad de una afirmación ni reconstruye razonamiento interno. La ruta de compatibilidad offline conduce al chat existente; no crea un segundo historial independiente.

Las reglas geométricas y los módulos de hipótesis son datos y operaciones acotadas. El prototipo requiere proximidad real del jugador y de la cámara; el mapa solo navega y no entrega objetos de misión a distancia.

## Verificación y límites

Se ejecutan pruebas con SQLite, geometría Three.js real, handlers de interacción, cliente de creación, aislamiento de propietarios, cancelaciones, reparación, hipótesis y presupuesto. Las dos regresiones observadas fueron una instantánea de fuente caducada (regenerada desde archivos inspeccionados) y la dependencia de fechas distintas en el presupuesto de obras vivas (corregida). También se ejecutan controles de tipos y compilación de producción.

No se ha realizado inspección gráfica GPU, escucha ni una partida de navegador en este entorno. No se acredita hiperrealismo ni capacidad general equivalente a modelos especializados. Los proyectos geométricos guardados todavía no se convierten por sí solos en nuevas funciones o reformas transitables de la casa. El siguiente paso debe ampliar ese contrato con pruebas de uso y reversión; aumentar contadores o frecuencia no lo sustituye.
