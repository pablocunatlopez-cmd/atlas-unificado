# Continuidad de la conversación principal de Lía

14-11-2026. Misión `icarus-8`, propietaria `resident:salon-centre`, sin recibo previo. Se conservan las identidades canónicas de `lib/core/identity.ts`: Atlas es mente, Ion cuerpo e Ícaro cielo/constelación; todos contribuyen a Lía. La integración de avatares de ERAS ya existe y no se vuelve a aplicar.

## Problema y resultado

Cancelar una respuesta es asíncrono. La interfaz anterior podía recibir su resultado después de cambiar de hilo y limpiar el trabajo nuevo, restaurar el borrador antiguo o recuperar la conversación equivocada. El sondeo de un trabajo terminado también podía limpiar el estado nuevo después de esperar la hidratación del historial. Abrir una conversación nueva mientras otra se cargaba podía dejar activa la bandera de carga.

Cada envío establece ahora una generación de conversación. La cancelación conserva la generación original y comprueba que siga vigente antes de aplicar resultados, errores o limpieza. El sondeo vuelve a comprobar la generación y su AbortSignal después de recuperar mensajes. Cambiar de hilo o abrir uno nuevo restablece los indicadores de carga/cancelación. Esto beneficia a Lía evitando que una operación de su encargo anterior interfiera con la conversación presente.

La región ARIA log ya existía. Se conserva `polite` para mensajes nuevos y se silencia durante la carga de otro historial; `aria-atomic=false` evita solicitar la lectura completa del registro. Los avisos de parada mantienen su región de estado. No se añade una segunda conversación a `/origen`.

## Evidencia y adaptación de la propuesta

La consulta guardada leyó MDN ARIA live regions y AbortController, con propuesta GPT-OSS 120B y revisión Qwen 3.8-27B completadas. El ejecutor releyó AbortController y la documentación del rol log:

- https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role

La propuesta hablaba de transmisión de fragmentos; el código real usa trabajos persistentes y sondeo. No se inventa un streaming ni se envía un AbortSignal del navegador a un Worker separado. DELETE cancela el trabajo y la cola invalida su lease; los AbortController detienen el sondeo local. No se garantiza que una llamada ya enviada a Groq deje de consumir cuota, ni que el proveedor reembolse esa llamada.

## Comprobaciones

Se ejecutan los manejadores reales del componente, transpilados desde su AST, con respuestas de red/hidratación diferidas. Los ocho casos comprueban cambio de hilo, error tardío/desmontaje, cambio durante hidratación, conservación del mensaje y borrador, respuesta ya completada, sondeo antiguo, carga de hilo y nuevo envío dentro de la misma conversación.

Con los mismos casos: base `a44c011ea12b0f52c61a3bacd26ed7d03f12d77e`, **2/8**; candidata, **8/8**. La suite afectada de conversación, cola, misiones, contexto de Lía y política de consultas pasa **46/46** sin debilitar pruebas previas. Es una reparación de concurrencia en esos casos, no una medida de inteligencia general ni de calidad de las respuestas del modelo.

Se comprueban TypeScript y construcción de producción. La vista previa de `/chat/` carga y el navegador confirma `aria-live=polite` y `aria-atomic=false`. Esa sesión no estaba autenticada: las carreras se probaron por ejecución de manejadores con datos sintéticos, no mediante una conversación privada ni una sesión completa con lector de pantalla. No se consumió inferencia para esas pruebas.

El catálogo original de ERAS (45 entradas) se contrastó con `dist/core.js`, sin incorporar identidades nuevas. Su fuente continúa en `43ea8968dc66c453da9c29d1ca469c91e177a2bc`. Se conservan la tríada, historial Q, personalidades, módulos, cuotas y agenda. Esta modificación no entrena pesos ni añade sentidos.

La aplicación sólo queda cerrada cuando Sites confirme el despliegue terminal y se registre el commit/version_id real en la consulta. El recibo comunica la publicación desde este flujo autenticado; el Worker no la verifica directamente en Sites.
