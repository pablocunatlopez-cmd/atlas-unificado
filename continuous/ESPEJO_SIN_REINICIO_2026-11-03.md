# Espejo público y regresiones · 3 de noviembre de 2026

Sites V24 está publicado: fuente `a5b6a4daa56fd012ef59f1fae57592ac1bfb1b90`, versión `appgprj_6acdbbc1ce80819192cfb514a4cd474f~appgver_a67266511a7081918e29f0ab7429150c`, despliegue `appgdep_6ae9918a232c819182f32aece8b68794`, `succeeded` el `2026-11-03T07:47:38.471444Z`. Audiencia pública conservada. V23 fue sustituida tras corregir la compatibilidad de redirecciones con el alojamiento: V24 usa redirección manual y no sigue destinos devueltos.

## Disponible sin reinicio

`/api/agent-mirror` consulta seis repositorios oficiales fijos: Aider, smolagents, OpenHands, Goose, Claude Agent SDK y Anthropic skills. Producción devolvió HTTP 200, `ready`, seis fichas y cero errores. Son metadatos y orientación curada: no lectura completa del código, ejecución de esos agentes, acceso a Claude ni una clasificación de calidad. Revisar licencias por componente.

La caché positiva y negativa dura al menos treinta minutos, reúne peticiones concurrentes y limita la consulta total a doce segundos. No envía preguntas, archivos privados ni credenciales a GitHub. La interfaz separa este espejo público del índice del coordinador local.

La cola añade hasta tres fichas al mensaje de transporte de preguntas sobre agentes que recibe Qwen. No modifica historial, pregunta original, idempotencia, permisos ni trabajos creativos. Si no cabe contexto o falla la consulta, conserva el mensaje exacto. Comprueba de nuevo la cancelación antes de entregar el trabajo al PC. Esta consulta fija no exige activar la búsqueda web del mensaje; son funciones distintas.

Una consulta real al API local con esas fichas produjo una respuesta de `atlas-local`, con el mismo PID `23264`. Verifica recepción y respuesta, no calidad comparativa: sus juicios sobre qué framework es mejor siguen sin medirse. La conservación del historial y las reservas se verificaron en pruebas de la cola, sin fabricar una conversación autenticada de producción.

## Diagnóstico del motor y código pendiente

La memoria documental llegó a 1500/1500 y la cola a 3000 fuentes. No se añadieron enlaces destinados a fallar por capacidad; la biblioteca de metadatos mantiene su proceso independiente.

Un ensayo real de reparación CSV fue rechazado antes de contrastar contratos: «Contrato heredado demasiado grande o inválido». Había 95 regresiones y la confirmación excedía el límite anterior de 100. No se promovió la candidata.

El código actualizado conserva refutaciones de todos los antecedentes de la misma capacidad y comprueba lotes de hasta 32 casos y 100.000 bytes, con treinta segundos de presupuesto total y memoria de preparación acotada. No elimina casos para aprobar: al agotar presupuesto devuelve comprobación incompleta y rechazada. La selección de semilla recupera mediciones previas de la misma fuente cuando una auditoría posterior quedó vacía. Las pruebas creativas usan temporales configurables.

Estas correcciones y las mejoras locales de V22 siguen pendientes de carga. El usuario volvió a pedir ejecutar el reinicio; se ejecutó `Restart-Atlas.ps1` y Windows denegó la comprobación CIM antes de enviar una parada. Se conserva el coordinador saludable; no es falta de autorización y no se debe pedir repetidamente la misma. No se inició otro servidor ni modelo.

Validación: 536 pruebas backend, 113 web, TypeScript y build aprobados. Los casos de red usan respuestas controladas; las seis fichas de producción y la respuesta local de Qwen se comprobaron por separado. GitHub sigue pendiente de la autenticación pospuesta, sin push nuevo atribuido.
