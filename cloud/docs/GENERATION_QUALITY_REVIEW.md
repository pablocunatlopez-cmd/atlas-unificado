# Calidad real de Lía y sus generadores

Revisión de implementación, 15 de noviembre de 2026.

La intención es construir una Lía conversacional y creativa: Atlas piensa, Ion ejecuta e Ícaro conecta conocimiento y agentes. Los habitantes deben convertir esa colaboración en resultados que se puedan utilizar y revisar. Dar nombre y personalidad a un proceso no aumenta por sí solo la capacidad de su modelo, sus herramientas ni sus gráficos.

## Por qué el resultado no acompañaba la intención

| Problema encontrado | Consecuencia para la persona | Corrección aplicada |
| --- | --- | --- |
| La ruta de conversación forzaba Qwen aunque otro modelo hubiera superado mejor las pruebas disponibles. | La selección de agentes apenas mejoraba la conversación ordinaria. | Todos los roles pueden elegir el modelo calificado con mejor resultado. La evaluación sigue siendo pequeña: ocho casos sintéticos, sin demostrar superioridad general. |
| El historial se recortaba en dos etapas y el contexto se cortaba como una cadena JSON. La suma podía superar el límite de transporte. | Pérdida de acuerdos y respuestas fallidas con conversaciones largas. | Un único constructor distribuye 15.000 caracteres entre identidad, encargo completo, intercambios, preferencias y datos estructurados. Reserva espacio para las instrucciones del rol. |
| El Worker no recuperaba la memoria personal guardada en `atlas_state`. | Lo que la persona había guardado en memoria no llegaba al modelo del chat. | Consulta por usuario, selección de preferencias y datos pertinentes, exclusión de recuerdos retirados y conservación explícita del estado «Por revisar». |
| Un detector de palabras convertía preguntas sobre generación en encargos de vídeo o 3D. | Una conversación sobre capacidades podía terminar en un error por falta de GPU. | La conversación permanece conversación. Los talleres se abren mediante acciones explícitas y accesos visibles. |
| El diseño 3D añadía hasta ocho objetos al mismo escenario prefijado. | Encargos diferentes producían casi la misma escena. | El contrato v2 permite una composición propia de hasta 32 objetos, grupos, materiales y cámara. Sustituye los objetos de la plantilla; conserva controles y objetivos cuando se trata de un juego. |
| La música ofrecía patrones prefijados, sin un encargo al modelo. | No había composición musical a partir de una descripción. | Noa genera una partitura de varias secciones con melodía, acordes, bajo, percusión y arreglo. Se reproduce y exporta el arreglo completo mediante síntesis del navegador. |
| La generación neuronal de vídeo dependía de una GPU del PC. | El camino anunciado no funcionaba en la nube gratuita. | Faro genera un guion de planos para grabar la casa existente. El runtime ejecuta encuadres, movimiento y duración por plano. Es captura 3D dirigida por IA. |

## Qué se puede mejorar automáticamente

La casa puede ejecutar herramientas acotadas, guardar propuestas, producir programas de escena y conservar una memoria de resultados. Las tareas de ingeniería de nube pueden modificar el código y publicar una versión después de comprobarla. Las composiciones y los proyectos tienen contratos, procedencia y mecanismos para conservar la versión anterior ante fallos.

En la investigación visible de una misión de 3D o juegos para Atlas, una propuesta real con memoria guardada puede encargar una nueva obra al modelo y a un revisor distinto. Cuando el propietario es un módulo o proceso, un residente actúa como constructor visible y la evidencia conserva el identificador de su propietario original. Se exige margen para las dos llamadas dentro de la cuota automática. Entre creación, revisión y aplicación se vuelve a comprobar que la sesión siga visible y la actividad habilitada. Los turnos ordinarios conservan los experimentos locales; los encargos de reformas completas siguen en la cola de ingeniería. Un latido de presencia mantiene vigentes las sesiones visibles durante consultas largas.

Esto no modifica los pesos del modelo conversacional. Una vuelta de investigación, una animación, otra disposición geométrica o una validación de formato tampoco demuestra mayor inteligencia o calidad artística. La selección de contexto es memoria de aplicación; la síntesis Web Audio es sonido generado por instrumentos; los personajes son representaciones de roles que usan los modelos autorizados.

La actividad local de la casa y las llamadas a modelos tienen ritmos distintos. El límite actual es de 60 llamadas diarias, con las tareas automáticas limitadas a 48 para reservar margen al uso directo. Un chat puede consumir una llamada principal, otra de revisión y otra si se pide preparar una búsqueda pública. Una creación musical o un guion usa una llamada, y repetir la misma solicitud completada recupera el resultado sin otra inferencia. Ese presupuesto no permite una consulta neuronal por segundo para cada personaje.

## Límites que todavía importan

- El generador geométrico admite cajas, esferas, cilindros y conos; no genera mallas orgánicas, texturas neuronales ni personajes equivalentes a los mejores servicios especializados.
- La música contiene decisiones del modelo y notas reales, pero sus timbres provienen de un sintetizador pequeño. No tiene las voces ni la producción de un modelo de audio neuronal.
- El vídeo registra la escena disponible. Una descripción no crea objetos ausentes, actores, iluminación nueva, voces o imágenes por difusión.
- Las intervenciones automáticas de la casa se mantienen dentro de su contrato de escena. No constituyen una remodelación arquitectónica ilimitada ni edición libre del servidor en cada fotograma.
- Las pruebas estructurales detectan fallos, pero no miden por sí solas fidelidad al encargo, belleza, musicalidad o conversación al nivel de los mejores modelos. Esas afirmaciones requerirían comparaciones y evaluación humana sobre encargos representativos.

La siguiente medida de progreso debe ser un resultado visible y utilizable que responda mejor al encargo, acompañado de su evaluación y de una versión recuperable. El número de vueltas o de personajes no sustituye esa medida.

## Comprobación del servicio publicado

En la versión 49 se ejecutaron dos encargos públicos de prueba con GPT-OSS 120B: una partitura de tres secciones y una dirección de tres planos que suma diez segundos. Ambas solicitudes devolvieron 200 y sus repeticiones recuperaron la misma creación. El presupuesto pasó de 30 a 32 llamadas: los reintentos completados no gastaron otras dos.

La inspección de la partitura detectó poca elaboración: dos notas y un acorde por sección. Se ajustó la orientación compositiva para desarrollar frases, sostener la armonía y distinguir las secciones sin convertir una cantidad de notas en criterio automático de calidad. Esta observación negativa se conserva; la validez de la respuesta no acredita que la pieza sea buena. La revisión del vídeo confirma el guion y sus restricciones, no una grabación realizada ni fidelidad visual de todos los detalles narrados. No se completó una inspección GPU ni una escucha en este entorno.
