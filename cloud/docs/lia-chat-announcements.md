# Salón: estados del chat separados del historial

15 de noviembre de 2026. Encargo `room:salon`, `work-9955c63a-1ea2-4c67-b7b8-0f420cca08fc`, consulta aceptada `icarus-13` (sin recibo al iniciar). Beneficiaria: Lía, interlocutora y entorno compartido de Atlas, Ion e Ícaro.

## Problema y cambio

Durante una respuesta había dos regiones `role=status`: el aviso temporal dentro de `role=log` y el estado persistente del pie. El aviso podía anunciarse por más de una vía y mezclaba estados de trabajo con el historial de mensajes. Además, al pedir detener la respuesta el estado seguía diciendo que Lía la preparaba.

El aviso visual queda fuera del log y conserva su botón de recuperación. Hay una sola región de estado persistente, explícitamente `polite` y atómica. Durante la solicitud de parada comunica «Solicitando detener la respuesta…»: no afirma que el servidor ya se haya detenido. Los mensajes mantienen su log, errores conservan `role=alert`, y la cancelación, recuperación e historial existentes se preservan.

La consulta proponía accesibilidad y una nueva API de aborto. La inspección confirma que el log y las guardias de cancelación ya existen (antecedente `lia-chat-continuity.md`); no se presentan como nuevos ni se añade `cancelCurrent()`. Esta intervención cierra una reforma acotada de accesibilidad del Salón, no acredita cada sugerencia del texto del modelo ni interrumpe mágicamente solicitudes de otro Worker.

## Evidencia y comprobaciones

Fuente leída: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions — distingue logs, estados, alertas, prioridad y contenido atómico. La consulta conserva su URL, fecha y fragmento (`source-79dce9e0a7944b8a96eed416`) y la referencia AbortController. Autor GPT-OSS 120B y revisor Qwen 3.8-27B completaron su colaboración histórica; esta reforma no hace nuevas llamadas de IA ni atribuye sus pruebas a esos modelos.

Los mismos seis casos de `atlas-chat-announcements.test.mjs` ejecutan el componente real con hooks sustituidos para controlar el estado y examinan su árbol de elementos: base 1/6, candidata 6/6. Cubren cola, ejecución, reconexión, parada, región persistente y errores. Pasan las ocho regresiones de carreras del chat y 21 de house-work, política, misiones y contexto; TypeScript sin emisión pasa. Los dobles no ejecutan red ni inferencia.

El árbol de elementos y las guardias se comprueban automáticamente; la pronunciación, duplicaciones reales y comportamiento de cada combinación navegador/lector de pantalla requieren una sesión con tecnología asistiva. No se acredita una auditoría axe/Lighthouse, escucha de lector, revisión de WebGL ni mejora general de razonamiento. La publicación y sus IDs se verifican y registran después de construir y desplegar, no por esta nota.

## Conservación

Base Atlas `e24881e96e762d10f3c624e2716e2c7ebb631b1a` (versión 46), ERAS `43ea8968dc66c453da9c29d1ca469c91e177a2bc` (versión 13), GitHub main `069e38b9ad890f3ef58ee4f0689917372a1367e1`. No se encontró trabajo ajeno adicional en esas líneas. Las 45 identidades del catálogo ERAS coinciden con su instantánea; no se añaden personajes. Las candidatas y rechazos de Vera quedan en sus ramas, fuera de esta reforma. No se cambia agenda, cuota, proveedor, pesos, juez, personalidad ni conversación Q. La vuelta `scheduled:2026-11-15T03` ya estaba guardada al comenzar y no se duplica.

Vista previa abierta en Chrome, sin iniciar sesión ni enviar mensajes: se observaron un log y una sola región de estado con `aria-live=polite` y `aria-atomic=true`. Esto comprueba el DOM real inicial; los estados con trabajo activo se comprobaron con el componente y los dobles de prueba. No se ha escuchado un lector de pantalla.
