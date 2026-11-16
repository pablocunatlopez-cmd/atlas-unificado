# Auditoría de integración de Lía en Atlas Unificado (2026-11-16)

## Alcance verificado en código
- La interfaz principal `cloud/app/chat/page.tsx` usa `cloud/app/cloud-chat.tsx`, que envía a `/api/cloud/chat`.
- `/api/cloud/chat` autentica al usuario y encola trabajo mediante `cloud/lib/cloud/queue.mjs`. La cola D1 almacena conversaciones y espera al puente del motor local.
- El motor conversacional completo reside en `continuous/chat.mjs`: integra recuperación documental, proveedores, LOR Omega y clasificación de procedencia. Su disponibilidad depende del puente y de las capacidades reales del motor conectado.
- `/api/chat` y `cloud/lib/atlas-core.ts` son un **núcleo nativo distinto**: reglas, recuperación y cálculos; no equivalen al motor completo de Lía.
- La ruta experimental `/chat/offline/` ahora redirige a `/chat/`. Se ha eliminado su componente paralelo para evitar confundir al usuario.

## Defectos encontrados y mitigaciones
1. **P0: doble interfaz presentada como Lía.** Corregido: un solo chat canónico; redirección de la ruta anterior y pruebas de regresión.
2. **P0: promesa de respuesta inmediata sin PC.** No existe un modelo conversacional completo verificable en la nube. El chat principal encola mensajes si el puente no está conectado. No inventar una respuesta ni atribuirle capacidades de Qwen.
3. **P1: memorias fragmentadas.** `atlasState.threads` (Atlas Core) y `cloud_conversations/cloud_messages` (Lía principal) son almacenes distintos. La recuperación léxica de `/api/chat` **no** implica que `continuous/chat.mjs` reciba esas memorias. No fusionar ni replicar datos automáticamente.
4. **P1: rutas y helpers experimentales sin consumidor.** `lia-offline-state.mjs`, `lia-session-context.mjs` y `lia-saved-retrieval.mjs` quedan acotados al subsistema Atlas Core o como utilidades sin uso en el chat principal. Revisar antes de migrar; no atribuirles integración.
5. **P1: validación insuficiente de despliegue.** Las pruebas de código fuente no demuestran compilación, funcionamiento en Cloudflare, conexión del puente ni publicación en Sites.
6. **P2: identidad epistemológica.** Conservar la distinción entre hechos, hipótesis, memoria del usuario y resultados de herramientas. No convertir los vértices Mental (Atlas), Físico (Ion) y Dios (suceso que reescribe el sistema) en afirmaciones de capacidades ya operativas.

## Plan de integración seguro
1. Mantener **un único historial conversacional canónico** en la cola privada D1, sin duplicar respuestas en Atlas Core.
2. Definir un contrato explícito de capacidades del puente: conectado/desconectado, modelos, recuperación, herramientas y versiones; mostrarlo en la interfaz.
3. Incorporar fuentes y memoria de Atlas al motor principal mediante adaptadores de lectura con procedencia, ámbito por usuario, límites de tokens y consentimiento. Probar aislamiento y resistencia a instrucciones inyectadas en documentos.
4. Integrar Ion/Constelación como módulos opcionales con comprobación de disponibilidad y permisos, no como proveedores ficticios.
5. Añadir pruebas de extremo a extremo y de compilación/despliegue antes de promover a `main`. La rama de auditoría no se fusiona automáticamente.

## Criterios de aceptación
- Todas las preguntas entran por el mismo chat y su historial permanece íntegro.
- Con el PC apagado, la UI informa de que el trabajo está en cola; no atribuye respuestas a un motor inexistente.
- Cada respuesta identifica motor, procedencia y límites; el sistema no afirma consultar módulos desconectados.
- La memoria es privada por usuario, auditable y revocable, sin transferencias silenciosas entre almacenes.
- CI verde y comprobación explícita del despliegue antes de afirmar que Lía está accesible.
