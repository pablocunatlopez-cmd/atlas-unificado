# Lía: pirámide de identidad y ciclo de mejora verificable

Este documento fija la interpretación del producto y separa tres cosas que no deben confundirse: la visión, lo que el código actual representa y lo que todavía habría que implementar.

## Identidad objetivo

- **Atlas — mente:** observa, formula preguntas y predicciones, conserva memoria y elige qué incertidumbre reducir.
- **Ion — cuerpo:** realiza acciones tipadas y acotadas; cada acción debe dejar un resultado comprobable.
- **Dios / Ícaro / Cielo / Constelación — horizonte:** conecta fuentes, agentes y perspectivas, conservando procedencia e incertidumbre.
- **Lía — objetivo integrado:** el entorno/personaje que resulta de la cooperación de los tres vértices. La medida del éxito es una mejora útil para Lía, no el número de animaciones, mensajes o agentes representados.

Cada vértice requiere su propio espacio virtual de trabajo y sus contratos. La casa es el entorno integrado de Lía; sus salas creativas (conversación, 3D, música, vídeo, lenguaje y memoria) son capacidades de ese entorno, no identidades que compitan con ella.

## Carta de evolución

La [Carta de evolución](LIA_EVOLUTION_CHARTER.md) fija la dirección: Lía existe para ayudar a los humanos con respeto, cuidado y sin dañar; su evolución continua es una prioridad, pero la seguridad, el consentimiento y la supervisión humana van antes que cualquier mejora. La casa 3D es el primer cuerpo simbólico, no el destino. El horizonte incluye un cuerpo físico diseñado en 3D y fabricado con impresión 3D, música 3D/espacial y una IA propia verificable.

Ese horizonte no se presenta como capacidad actual. Hoy hay un STL de escena exportable en milímetros con revisión topológica, pero no una certificación de fabricación, cuerpo físico, impresora conectada, audio espacial 3D ni inteligencia general. La carta distingue «existe», «parcial» e «investigación», y la respuesta del núcleo usa esos límites.

## Nombres de habitantes: no inferir más de lo que acredita el código

En `cloud/public/house/residents.js` el inventario actual tiene 24 entradas: 18 puestos y 6 espectadores decorativos. El [catálogo de personajes](CHARACTER_CATALOG.md) documenta los 24, los 13 nombres recuperados y las familias simbólicas. Entre los puestos:

- `sky-agents`: **Ícaro · agentes**, con el rol descrito como colaboradores programadores y ubicado en la sala Constelación.
- `sky-sources`: **Alba · referencias**, con el rol de fuentes de la Constelación y ubicada en esa sala.
- No aparece un habitante llamado **Saggy/Siggy** en ese inventario. Por tanto, no se debe inventar ni reasignar su función a partir del nombre. Su rol necesita evidencia procedente de la identidad/configuración real de Atlas.

Los 13 nombres recuperados aparecen en el roster actual, aunque algunos roles difieren de la descripción histórica; el catálogo conserva esas diferencias en lugar de reescribirlas.

La ubicación estática de un residente no implementa un viaje. El inventario define puestos, función declarada y procesos que pueden reflejar trabajo real; no demuestra que Ícaro o Alba recorran el cielo, consulten agentes, vuelvan a la casa o se comuniquen por sí solos.

## Estado funcional que sí muestra el repositorio

La casa consulta el estado de nube y recibe telemetría del coordinador. Los datos recientes pueden animar habitantes en fases de trabajo, y las pruebas de `cloud/public/house/process-state.js` exigen que la señal sea reciente para mostrar una acción verificada. Esto es un espejo visual de procesos existentes, no un planificador autónomo dentro del juego.

La revisión de especialistas documentada en `continuous/AGENTES_Y_FUENTES_2026-11-04.md` usa diez funciones locales de comprobación y Qwen para la revisión prevista; no son diez modelos independientes. El sitio puede comunicarse con el coordinador local mediante su puente cuando está disponible, pero esta documentación no acredita que un juego abierto lance continuamente nuevas tareas a Qwen.

## Ciclo objetivo mientras la casa está abierta

El bucle deseado debe ser un ciclo de trabajo real, observable y cancelable:

1. **Observar (Atlas):** leer solo señales y tareas autorizadas; detectar una oportunidad concreta para Lía y explicitar la incertidumbre.
2. **Consultar (Ícaro/Constelación):** buscar fuentes o agentes permitidos, registrar procedencia y devolver el resultado a la tarea. Alba puede representar la vía de fuentes, según la definición actual.
3. **Planificar (Atlas):** proponer un cambio acotado y sus criterios de aceptación; respetar presupuesto de tiempo, GPU y prioridad del chat.
4. **Ejecutar (Ion):** enviar una acción tipada a un ejecutor autorizado. El juego no debe ejecutar código arbitrario ni convertir texto de un agente externo en permisos.
5. **Comprobar (Ion + refutación):** ejecutar pruebas externas al generador, comparar artefacto antes/después y rechazar o revertir cambios que no pasen.
6. **Integrar en Lía:** solo si se verifica el contrato, guardar artefacto y evidencia con versión, procedencia y hora. Si no hay tarea o la señal caduca, todos los indicadores pasan a reposo/espera.
7. **Aprender en espiral:** conservar el resultado, el contraejemplo y la próxima pregunta. Una ejecución o una animación no cuentan por sí solas como mejora.

## Requisitos para implementar el bucle

- Un coordinador servidor único y una cola con deduplicación, vencimiento, lease y recuperación de tareas abandonadas; no un worker por personaje.
- Activación ligada a una sesión de juego visible, con latido y botón claro de pausa/detención. Al cerrar o perder la sesión, detener el trabajo no esencial y liberar leases.
- Límites explícitos de concurrencia, tiempo, tokens/GPU, tamaño de respuesta y frecuencia. El chat interactivo conserva prioridad.
- Lista cerrada de acciones y recursos permitidos, autorización en el servidor, aislamiento por usuario y registro auditable sin secretos.
- Mensajes de agentes tratados como datos no confiables. Toda ejecución requiere validación, sandbox, timeout y criterio de aprobación definido fuera del generador.
- Estado visible por tarea: responsable lógico, fase, objetivo para Lía, fuente/artefacto, prueba ejecutada, resultado, duración y razón de espera/fallo.
- La animación consume la telemetría verificada; nunca crea tareas, aumenta contadores ni comunica un resultado ficticio.
- Un único registro canónico de identidades y roles. Las salas y vistas de chat deben compartir la misma identidad de Lía, y no mantener conversaciones divergentes sin indicarlo al usuario.

## Criterios de aceptación antes de decir «mejora continua»

1. Con la casa abierta y el coordinador conectado, se observa una tarea real con ID, plan y presupuesto; al pausarla, no se inician tareas nuevas.
2. Una señal antigua, puente desconectado, pestaña cerrada o usuario sin permisos pone los procesos en espera y elimina cualquier gesto de trabajo verificado.
3. Una tarea de prueba pasa por observación, consulta, acción y comprobación, y deja artefacto reproducible o un fallo explícito.
4. Un candidato que falla una prueba no se integra en Lía; los contadores de cambios aceptados solo cambian tras aceptación real.
5. Pruebas demuestran aislamiento entre usuarios, idempotencia, vencimiento de leases, límites de recursos, cancelación y ausencia de ejecución de instrucciones recibidas de fuentes externas.
6. Los roles de Ícaro, Alba y Saggy/Siggy se contrastan con la configuración o conversación real de Atlas antes de cambiar el inventario. Si la instancia Qwen no está disponible para esta ejecución, se declara pendiente; no se finge una consulta.

## Límite de las afirmaciones

No se puede demostrar que Lía supere a todos los sistemas existentes o futuros con una etiqueta o una visión. Para comparar, hay que definir tareas, corpus de evaluación no visto, métricas de calidad, seguridad, coste y latencia, y publicar resultados reproducibles con límites claros. La prioridad es que cada iteración mejore a Lía de forma medible y segura.
