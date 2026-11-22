# Procedencia al recuperar reflexiones

21-11-2026. Base Atlas v60, 7cc706e46d0430e2634459f6f76d7a0d2d492699. Misión resident:lab-desk: procedencia y contraste.

El filtro compartido reflectionContext comprobaba únicamente si los claims contenían identificadores. Una entrada histórica sin marca de grounding o explícitamente unverified podía recuperar su conclusión y afirmaciones como contexto pese a no tener aceptación explícita de procedencia. Dos pruebas sintéticas fallaban en v60 y pasan después con los mismos datos y criterios.

La candidata exige grounding=source-linked y referencias no vacías para conservar conclusión/claims. En cualquier otro caso ofrece una explicación de abstención y conserva las incertidumbres. El objeto persistido no se modifica ni se borra. La salida declara grounding y recuerda que source-linked sólo enlaza referencias: no demuestra verdad ni implicación lógica. No realiza una nueva comprobación semántica ni vuelve a leer URLs. Una marca source-linked incorrecta pero estructuralmente válida sigue siendo un límite de confianza del almacén.

Los consumidores reales son lib/cloud/worker.ts (contexto de conversación) y lib/research/deliberation.ts (planificación de investigación). Los datos históricos siguen archivados y pueden revisarse; no se promueve una hipótesis a hecho por el mero aspecto de una cita. No se modifican el juez de estrategias, baremo, modelos, cuotas, privacidad, conversación Q, identidad de la tríada ni el motor ERAS.

Fuente pública leída: https://www.w3.org/TR/prov-overview/ (nota W3C del 30-04-2013). Aporta la distinción de procedencia de entidades/actividades y su uso para evaluar confianza; no especifica nuestro contrato privado ni verifica nuestras conclusiones. La regla concreta de filtrado es una decisión de ingeniería coherente con el contrato de Atlas.

Ejecutado: 29 pruebas de grounding, Worker real con red sustituida, investigación, SQL y misiones; todas pasan. TypeScript sin emisión pasa. No se gastan llamadas de Groq en esas pruebas. La regresión histórica 107!=38 de otra suite continúa documentada y su candidata aislada 9513c675a0860b961bd069e6bb8715670f1dcfac se conserva sin integrarla aquí.

GitHub main inspeccionado en 86b08002ed57a806d3a270f362a326f3ae694dd3; se conserva su línea sin forzar ni sobrescribir. No se incorporan nuevas identidades. ERAS v13 conserva su motor y recursos; la integración de avatares ya publicada no se repite. La propuesta ordinaria icarus-73 sobre el Taller de ERAS fue rechazada y no se aplica.

El resultado medido es evitar que los dos casos sintéticos no verificados filtren su conclusión al contexto. No acredita mayor inteligencia, verdad de fuentes, aprendizaje de pesos ni mejora gráfica o musical. El resultado de publicación y sus identificadores se registra únicamente después del despliegue terminal.

Bloqueo de esta candidata: icarus-74 terminó blocked, sin fuentes ni respuestas de modelo: el lector del Worker no pudo leer la referencia W3C. La lectura pública del ejecutor sí se completó, pero no se inventa una lectura del Worker ni un recibo de aplicación. No publicada. Pendiente una consulta posterior con referencia accesible y trazabilidad completa antes de integrar.

## Cierre de la intervención, 22-11-2026

La consulta icarus-82 recibió la evidencia real del filtro publicada en v61 y dos referencias MDN sobre === y &&. GPT-OSS120B propuso y Qwen revisó; ambos completaron su paso y la propuesta quedó aceptada. El revisor identificó explícitamente el fragmento privado como contrato actual, sin exigir que MDN documentara ese código. Se conservan los rechazos 75/77 y el bloqueo 74; no son aplicaciones anteriores. Las referencias guardadas son source-5b386d62b33aaf716b4a3441 y source-a6e42b8931fad1c861362585.

La integración sobre v61 vuelve a pasar 35 pruebas (grounding, Worker con red sustituida, investigación/SQL, misiones, evidencia del repositorio y límite de transporte) y TypeScript sin emisión. Los dos contraejemplos siguen siendo los mismos que fallaban antes: marca explícita unverified con claims y entrada histórica sin marca. Tras el cambio se excluyen conclusión y claims, sin mutar el archivo histórico ni retirar las dudas. source-linked explícito conserva el contenido y su advertencia de límites.

Se regeneró la evidencia del repositorio con el filtro nuevo para que el guard de construcción siga verificando el código actual. La candidata antigua de 107 memorias continúa separada; no se modifica el catálogo ni el juez para subir resultados. ERAS v13, identidades, conversación Q, recursos gráficos y runtime del estudio se conservan. La aprobación 82 sólo acredita que esta revisión se completó con el contexto aportado, no superioridad general de los modelos. Las notas previas sobre no publicación describen las fases históricas de la candidata; el despliegue y los recibos terminales se verifican por separado.
