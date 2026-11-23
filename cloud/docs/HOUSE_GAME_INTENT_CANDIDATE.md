# Conservar preguntas sobre el juego como conversación

Base: Atlas Sites v57, `2f574434b0f080d14e763aca12f8f063854caa1e`. ERAS v13, `43ea8968dc66c453da9c29d1ca469c91e177a2bc`. Los cambios del propietario en materiales PBR, doce funciones, personalidades y juego de la casa se conservan.

## Defecto reproducido y cambio

El Worker consulta `housePrototypeRequest` antes de la conversación. La heurística anterior enviaba directamente el enlace del prototipo ante «Quiero saber si puedes crear un videojuego en la casa de Lía», «Crea una lista de ideas para un videojuego en casa» o una petición de guion. No se respondía al encargo. Además, rechazaba «Haz un videojuego en la casa de Lía y explica los controles» por encontrar la palabra explica en cualquier posición.

La candidata reconoce la acción y su objeto inmediato: un juego, videojuego o prototipo/demo de juego, con un conjunto limitado de determinantes y adjetivos. Las preguntas o solicitudes de análisis, listas, reuniones o guiones no se sustituyen por el enlace. Los encargos directos pueden incluir una explicación de controles y conservan el prototipo sin inferencia. La negación conserva prioridad. Es una heurística de español acotada, no comprensión general de cualquier idioma o formulación.

Dos grupos de casos nuevos fallan en la base y pasan en la candidata (suite de juego 2/4 → 4/4). Dos pruebas adicionales ejecutan el Worker real con SQLite y transporte simulado: la pregunta llega completa al modelo de conversación; el encargo directo con controles recibe el prototipo sin invocar inferencia. No se ha llamado a modelos reales para estas pruebas.

Pasan 27 pruebas entre juego, materiales, funciones de cine, Worker y contexto, TypeScript sin emisión y compilación de producción. Las doce funciones, mapas PBR, `data/studio-runtime.json` y módulos ERAS permanecen intactos. Se han comprobado los hashes de los 17 módulos ERAS contra el origen limpio. No se ha hecho revisión GPU ni jugado una sesión en navegador en esta intervención.

Documentación leída: MDN Regular expressions (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions) y String.normalize (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize). Documentan las operaciones de texto; el criterio de intención se prueba sobre los ejemplos y procede del encargo de fidelidad del propietario.

## Antecedente del 15-11-2026: candidata no publicada entonces

El presupuesto automático sigue agotado (49/60 compartidas, límite automático 48); la reserva manual queda para la persona. No se fuerza una consulta ni un pulso foreground. Falta vincular la intervención a una misión con investigación pertinente y revisión disponible; no se registra como aplicada ni se cambia la versión publicada. Se conserva el código y sus pruebas para continuar tras la renovación, sin repetir una demostración de IA.

GitHub main contiene trabajo ajeno nuevo en `ecb5e28a609478bf454b6b6e4c34ff1671439d1b` («Merge Atlas reliability and security improvements»), con módulos y pruebas en continuous, auditorías y CI. Se han inspeccionado el inventario y el comienzo del diff; no se afirma una revisión completa ni integración de ese conjunto grande. No se altera main ni PR 1 y no se sobrescribe esa línea. Su integración exige su propia inspección, correspondencia de rutas y comprobaciones; queda separada de esta candidata pequeña.

## Continuación del 21-11-2026

Se ha abierto la fuente actual de Sites y se ha recuperado la candidata sin sobrescribir la casa v57. La cuota del día estaba renovada. La consulta `icarus-69`, `engineering:house-game-intent-v1`, vinculó el encargo a `resident:salon-centre` y leyó las dos referencias anteriores (`source-08f5a92a2e3103f86c913de7`, `source-b0f35437e99ff7e066631c10`). El proponente GPT-OSS 120B completó una respuesta; el revisor Qwen quedó indisponible por «El contexto supera el límite de esta vuelta». Se conserva el fallo; no se afirma aprobación de modelo ni reflexión completada. La evaluación de la reforma de código procede de inspección y ejecución del Worker y de las pruebas, no de ese texto incompleto.

Se repitieron los controles afectados: 27 pruebas, TypeScript sin emisión y conservación de las superficies, doce vínculos y runtime de proyectos. La construcción y el resultado terminal de Sites se comprueban por separado antes de comunicar recibos. Esta continuación sustituye el bloqueo de cuota del antecedente anterior; no modifica el límite ni el proveedor. El problema de contexto del revisor permanece pendiente como otro defecto.

GitHub main ha seguido avanzando hasta `86b08002ed57a806d3a270f362a326f3ae694dd3` (prueba de conocimiento compartido entre personajes). Se conserva esa línea: la presente reforma acotada no importa todo el conjunto ni declara una integración completa de GitHub. El historial de Sites y sus cambios visuales permanecen en su propia línea sin forzar GitHub main ni PR1.
