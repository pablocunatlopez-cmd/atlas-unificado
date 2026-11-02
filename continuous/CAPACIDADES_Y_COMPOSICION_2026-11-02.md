# Capacidades, composición y reparación por evidencia

Entrega del 2 de noviembre de 2026.

## Cambios operativos

- El chat puede componer hasta tres funciones puras ya aprobadas. Cada paso conserva su entrada, resultado y procedencia. Todo el plan se valida antes de ejecutar; un fallo parcial no se presenta como resultado final.
- Las peticiones explícitas con un único JSON inequívoco pueden dirigirse a herramientas canónicas sin otra inferencia. Se conserva literalmente el JSON recibido, incluidas claves especiales; las peticiones ambiguas, negaciones o solicitudes de código vuelven al planificador general.
- El selector general rechaza JSON `null` sin abortar el chat y presupuesta el catálogo aparte de la petición. Respeta el límite de mensajes del motor sin cortar ejemplos JSON ni el final de la petición admitida.
- Los resultados canónicos se muestran como JSON de la ejecución, con nombres públicos de los pasos. No se pide al modelo que reescriba cantidades ya calculadas ni se imprimen IDs privados, fechas o entradas del runtime.
- La construcción con contratos contrasta físicamente el código antes de repararlo. El modo interno de código evita otra reescritura verbal previa; la revisión solicitada en conversaciones normales permanece disponible.
- Las reparaciones conservan el código íntegro de la implementación con mejores resultados medidos, sus refutaciones y los contratos heredados. No reinician necesariamente desde el último intento, que puede haber empeorado. Si la confirmación refuta la candidata, el constructor puede alimentar automáticamente otra reparación, hasta tres rondas. Se conservan las versiones y los contraejemplos; los casos de confirmación ya vistos pasan a ser feedback de desarrollo. Las variantes aprobadas no se acumulan indefinidamente como nuevos contratos heredados.

## Currículo ampliado

Ocho familias tienen ahora contratos y oráculos delimitados. Las dos nuevas son `csv-parse` y `json-patch-apply`. Solo una candidata que pase sus comprobaciones aparece como herramienta utilizable; un descriptor o un intento no acredita una capacidad.

CSV analiza texto ya aportado, con separadores definidos, comillas, campos vacíos y límites de recursos. JSON Patch transforma un documento JSON en memoria, conserva atomicidad y admite precondiciones `test`; no escribe archivos ni modifica el servidor. Ambos perfiles declaran sus límites y diferencias respecto a [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) y [RFC 6902](https://www.rfc-editor.org/rfc/rfc6902).

La construcción solicitada al coordinador usa ocho casos de desarrollo. Después ejecuta casos adicionales generados por un oráculo del programa y conserva regresiones; esos casos nuevos no se entregan al constructor antes de evaluar su candidata. Son confirmaciones acotadas del mismo perfil, no un examen ciego universal. Los fallos observados pueden formar parte de la siguiente reparación.

Las construcciones solicitadas localmente conservan `requestedBy:local-user` y un origen diferenciado. No se cuentan como elección autónoma de Atlas ni incrementan por sí solas el contador de aprendizaje de la espiral.

## Comprobaciones reales

El chat local en modo compartido superó tres tareas: deduplicar y después calcular estadísticas, ordenar dependencias con nuevos nodos listos y resolver una clave propia especial mediante JSON Pointer. Se comprobaron los resultados de ejecución, no la prosa del modelo. Las tareas tardaron 45, 15 y 14 milisegundos en esa ejecución local y no llamaron al modelo. Es una observación puntual, no una comparación de inteligencia ni de rendimiento entre dispositivos.

Los ensayos de construcción detectaron candidatos CSV y JSON Patch incorrectos, incluidos casos con ocho aciertos de desarrollo y fallos de confirmación. Se conservaron sin activarlos. La disponibilidad final se consulta en Actividad; el mero hecho de añadir un reto no se presenta como aprendizaje logrado.

La web está publicada en Sites V18, fuente `5d179fa2ceda4370e76af8797c90d504783d75a4`. Mantiene la GPU y la inferencia en el PC, el historial por usuario y los límites de la sesión compartida.

## Consistencia y límites

La escritura de estado es encolada y atómica, con cancelación comprobada dentro de la cola y antes del commit. Cancelar mientras se espera no puede confirmar después una candidata; un commit ya efectuado se reconoce como tal.

Aider, smolagents y el constructor nativo siguen utilizando el mismo Qwen. No son modelos independientes ni las extensiones protegidas de Codex. Las mejoras aquí afectan al programa, a la ejecución y a su método de reparación. No demuestran que los pesos de Qwen hayan alcanzado un modelo superior ni activan un adaptador sin evaluación.
