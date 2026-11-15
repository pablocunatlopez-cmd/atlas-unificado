# Auditoría funcional de Atlas y ERAS

Observación del código: 12 de noviembre de 2026. Esta auditoría amplía el anterior análisis de 24 oficios; no añade personajes ficticios para aumentar un contador.

## El problema y el cambio aplicado

Ícaro seleccionaba únicamente las 24 figuras de la casa. Las salas y cuatro módulos podían recibir memoria agregada, pero no iniciar encargos propios. Los 30 personajes, 10 escenarios y 5 edificios del catálogo de ERAS estaban fuera de ese circuito. Los 13 procesos del núcleo, sus dos actores conceptuales adicionales, siete dominios personales y dos sentidos instrumentales tampoco tenían una identidad de misión. Cuatro salas seguían mostrando el antiguo PC y controles GPU que la API de nube rechaza.

El registro ahora contiene **107 responsables de misión**: 24 resident, 10 room, 4 module, 2 core, 7 domain, 13 process, 2 sense, 30 character, 10 zone, 5 building. No son 107 modelos ejecutándose simultáneamente. Las identidades del juego conservan su época, nombre y función; los especialistas de ingeniería trabajan sobre su comportamiento y código. Las salas coordinan, los módulos comparten capacidades, los procesos ejecutan tareas concretas y los sentidos solo describen capacidades realmente implementadas.

## Identidad, funciones y método

Cada entrada tiene identificador estable, nombre original, especialidad, pregunta, destino Atlas/ERAS, archivos, referencias candidatas, criterios de prueba y un delegado físico. El propietario de la misión y su memoria se mantienen separados del habitante que representa la consulta en 3D. Un personaje de ERAS no se convierte en un avatar de Atlas por compartir nombre.

Las seis fases y doce campos LOR son operaciones del método, no dieciocho personajes nuevos. Atlas/Mente y Dios/Suceso/Unidad conservan su sentido original: perspectiva situada, incertidumbre, sorpresa y límites; no se atribuye causalidad empírica a la metáfora.

## Ejecución y continuidad

La rotación intercala diez familias y visita cada responsable una vez por vuelta. No recorta la consola a 32 entradas. A una ejecución por hora, una vuelta completa de 107 encargos necesita aproximadamente 4.5 días si no hay pausas ni fallos; registrar funciones no acelera por sí solo la capacidad de cómputo. Cada consulta puede consumir dos llamadas de modelos. Se mantienen las cuotas actuales de 60 al día UTC y reserva automática hasta 48.

Las misiones equivalentes del cuerpo, herramientas y programación pueden ejecutar el laboratorio acotado cuando esté pendiente y haya cuota. Refutación y revisión pueden evaluar estrategias en sus propios turnos. Esto no convierte a un guerrero de ERAS en autor de expresiones numéricas ajenas a su oficio. El flujo de ingeniería en nube sigue siendo el que inspecciona repositorios, cambia módulos completos, ejecuta comprobaciones y publica en Sites.

La migración añade memorias ausentes sin borrar las anteriores. Un encargo de sala no incrementa dos veces la misma memoria por ser a la vez propietario y agregado. Las consultas manuales también sincronizan su memoria con control de concurrencia; los reintentos reutilizan el mismo identificador. Una fuente sigue siendo evidencia por contrastar, una propuesta no es código ejecutado y un rechazo necesita otro intento que resuelva la objeción. No se admite registrar directamente como aplicado un intento rechazado.

## Punto de partida y límites reales

ERAS ya ofrece avatares con esqueleto, animaciones, materiales, cámara y rutas de render. Ese inventario se comparte entre autor y revisor para evitar exigir a una página pública que documente nuestro código privado. Se inspecciona la base antes de reinventar capacidades. La integración posterior de humanos cercanos se implementa en advanced-residents.js y se documenta en advanced-people.md; el registro por sí solo no realiza esa integración.

Vista significa medidas de luminancia, contraste y bordes. Oído significa RMS, pico, componente continua y recorte. No hay escucha ambiental, comprensión semántica de imágenes, transcripción, olfato ni tacto implementados. La grabación del lienzo y el audio requieren navegador abierto; la investigación, memoria y publicación se realizan en la nube. No se entrena el peso de los modelos externos mediante estas consultas.

Los 45 elementos de ERAS proceden de dist/core.js en el commit 43ea8968dc66c453da9c29d1ca469c91e177a2bc. Es una instantánea con procedencia: debe reconciliarse cuando cambie su catálogo, no presume descubrir nombres nuevos automáticamente.

## Verificación

Comprobaciones: cobertura de catálogos, identidades y delegados, rotación completa, destinos existentes, URLs permitidas, conservación de memoria histórica, idempotencia y herramientas apropiadas. Se ejecutan además regresiones de consultas, programas, viajes, TypeScript y construcción de producción. No se ha hecho revisión visual WebGL/GPU en este entorno.

## Registro completo

| Identidad | Nombre y función | Destino / delegado | Herramientas | Archivos de aplicación |
|---|---|---|---|---|
| resident:salon-centre | Lía · conversación: Conversación y contexto | atlas / salon-centre | source-reader, cloud-engineering | lib/cloud/worker.ts, app/cloud-chat.tsx |
| resident:music-console | Noa · composición: Composición musical | atlas / music-console | source-reader, cloud-engineering | lib/music/pattern.mjs, lib/music/audio.ts, app/music-studio.tsx |
| resident:music-mixer | Ritmo · mezcla: Mezcla y procesamiento de audio | atlas / music-mixer | source-reader, cloud-engineering | lib/music/audio.ts, lib/evolution/signals.ts, app/music-studio.tsx |
| resident:lab-desk | Vera · fuentes: Procedencia y contraste de fuentes | atlas / lab-desk | source-reader, cloud-engineering | lib/research/grounding.ts, lib/research/relevance.ts, lib/research/web.ts |
| resident:lab-bench | Nilo · experimentos: Diseño de experimentos | atlas / lab-bench | source-reader, cloud-engineering | lib/evolution/benchmarks.ts, lib/research/evaluator.ts |
| resident:games-desk | Talo · constructor: Ingeniería de gráficos | eras / games-desk | source-reader, cloud-engineering | dist/render-engine.js, dist/graphics.js, dist/world.js |
| resident:games-maquette | Zuri · maquetas: Interacción y prototipos jugables | eras / games-maquette | source-reader, cloud-engineering | dist/chase-camera.js, dist/world.js |
| resident:cinema-projector | Faro · vídeo: Cámara, encuadre y vídeo | atlas / cinema-projector | source-reader, cloud-engineering | app/cinema-panel.tsx, public/house/runtime.js, app/house-scene.tsx |
| resident:sky-sources | Alba · referencias: Descubrimiento de referencias | atlas / sky-sources | source-reader, cloud-engineering | lib/research/web.ts, lib/research/technical-reading.mjs |
| resident:sky-agents | Ícaro · agentes: Selección y colaboración de agentes | atlas / sky-agents | source-reader, cloud-engineering | lib/cloud/agents.ts, lib/cloud/agent-registry.ts |
| resident:mind-desk | Nora · memoria: Memoria y recuperación | atlas / mind-desk | source-reader, cloud-engineering | lib/evolution/world.ts, lib/research/server.ts, lib/cloud/queue.mjs |
| resident:body-console | Ion · herramientas: Herramientas y programación útil | atlas / body-console | source-reader, program-lab, cloud-engineering | lib/cloud/program-tools.mjs, app/api/cloud/program/route.ts |
| resident:body-arm | Pico · acciones: Acciones y contratos | atlas / body-arm | source-reader, program-lab, cloud-engineering | lib/cloud/queue.mjs, lib/research/storage-sql.ts |
| resident:refutation-candidate | Ada · contraste: Refutación y regresiones | atlas / refutation-candidate | source-reader, cloud-engineering | lib/evolution/benchmarks.ts, lib/evolution/coaching.ts |
| resident:refutation-control | Cota · laboratorio: Comparación y promoción de candidatas | atlas / refutation-control | source-reader, strategy-eval, cloud-engineering | lib/evolution/coaching.ts, lib/evolution/coach-server.ts |
| resident:language-object | Sol · estructura: Estructura del lenguaje | atlas / language-object | source-reader, cloud-engineering | lib/core/lor-spec.ts, public/core/language-model.mjs |
| resident:language-symbol | Sigma · símbolos: Símbolos e invariantes | atlas / language-symbol | source-reader, cloud-engineering | public/core/language-model.mjs, lib/cloud/arithmetic.ts |
| resident:language-meaning | Ema · sentido: Interpretación y significado situado | atlas / language-meaning | source-reader, cloud-engineering | public/core/language-model.mjs, lib/research/grounding.ts |
| resident:cinema-audience-1 | Teo · espectador: Crítica de narrativa audiovisual | atlas / cinema-audience-1 | source-reader, cloud-engineering | app/cinema-panel.tsx, public/house/runtime.js |
| resident:cinema-audience-2 | Luz · espectadora: Color e iluminación | eras / cinema-audience-2 | source-reader, cloud-engineering | dist/cinematography.js, dist/graphics.js |
| resident:cinema-audience-3 | Mara · espectadora: Escucha y claridad sonora | atlas / cinema-audience-3 | source-reader, cloud-engineering | lib/music/audio.ts, lib/evolution/signals.ts |
| resident:cinema-audience-4 | Mico · espectador: Movimiento e interacción | eras / cinema-audience-4 | source-reader, cloud-engineering | dist/chase-camera.js, dist/world.js |
| resident:cinema-audience-5 | Leo · espectador: Accesibilidad y comprensión | atlas / cinema-audience-5 | source-reader, cloud-engineering | app/house-scene.tsx, app/cinema-panel.tsx, app/music-studio.tsx |
| resident:cinema-audience-6 | Brisa · espectadora: Ritmo de montaje | atlas / cinema-audience-6 | source-reader, cloud-engineering | app/cinema-panel.tsx, public/house/runtime.js |
| room:salon | Salón de Atlas: Coordinación de Salón de Atlas | atlas / salon-centre | source-reader, cloud-engineering | app/cloud-chat.tsx, lib/cloud/worker.ts |
| room:music | Estudio de música: Coordinación de Estudio de música | atlas / music-console | source-reader, cloud-engineering | app/music-studio.tsx, lib/music/audio.ts |
| room:lab | Laboratorio: Coordinación de Laboratorio | atlas / lab-bench | source-reader, cloud-engineering | lib/evolution/benchmarks.ts, lib/research/server.ts |
| room:games | Taller de mundos: Coordinación de Taller de mundos | atlas / games-desk | source-reader, cloud-engineering | public/house/process-creatures.js, public/house/scene.js |
| room:cinema | Sala de cine: Coordinación de Sala de cine | atlas / cinema-projector | source-reader, cloud-engineering | app/cinema-panel.tsx, public/house/runtime.js |
| room:constellation | Cielo · Constelación: Coordinación de Cielo · Constelación | atlas / sky-agents | source-reader, cloud-engineering | lib/collaboration/server.ts, lib/cloud/agents.ts |
| room:mind | Mente · Archivo vivo: Coordinación de Mente · Archivo vivo | atlas / mind-desk | source-reader, cloud-engineering | lib/evolution/world.ts, lib/research/server.ts |
| room:body | Animal · Cuerpo de Ion: Coordinación de Animal · Cuerpo de Ion | atlas / body-console | source-reader, program-lab, cloud-engineering | lib/evolution/program-server.ts, lib/evolution/program-runtime.mjs |
| room:refutation | Cámara de refutación: Coordinación de Cámara de refutación | atlas / refutation-candidate | source-reader, strategy-eval, cloud-engineering | lib/collaboration/policy.ts, lib/evolution/benchmarks.ts |
| room:language | LOR-ΩΣ · Lenguaje: Coordinación de LOR-ΩΣ · Lenguaje | atlas / language-symbol | source-reader, cloud-engineering | lib/core/lor-spec.ts, lib/atlas-spiral.ts |
| module:graphics | Gráficos y rendimiento: Gráficos y rendimiento | atlas / games-desk | source-reader, cloud-engineering | public/house/render-engine.js |
| module:audio | Audio y señales: Audio y señales | atlas / music-mixer | source-reader, cloud-engineering | lib/music/audio.ts, lib/evolution/signals.ts, app/music-studio.tsx |
| module:programming | Programación y herramientas: Programación y herramientas | atlas / body-console | source-reader, program-lab, cloud-engineering | lib/cloud/program-tools.mjs, app/api/cloud/program/route.ts |
| module:perception | Percepción y recuperación: Percepción y recuperación | atlas / mind-desk | source-reader, cloud-engineering | lib/evolution/world.ts, lib/research/server.ts, lib/cloud/queue.mjs |
| core:atlas | Atlas · Mente y lenguaje: Perspectiva situada | atlas / language-object | source-reader, cloud-engineering | lib/atlas-core.ts, lib/atlas-types.ts |
| core:suceso | Dios · Suceso · Unidad: Sorpresa, incertidumbre y límites | atlas / sky-sources | source-reader, cloud-engineering | lib/research/deliberation.ts, lib/atlas-core.ts |
| domain:salud | Cuerpo y bienestar: Herramientas para cuerpo y bienestar | atlas / salon-centre | source-reader, cloud-engineering | lib/atlas-content.ts, lib/atlas-core.ts, lib/atlas-types.ts |
| domain:dinero | Dinero y seguridad: Herramientas para dinero y seguridad | atlas / salon-centre | source-reader, cloud-engineering | lib/atlas-content.ts, lib/atlas-core.ts, lib/atlas-types.ts |
| domain:relaciones | Vínculos y emociones: Herramientas para vínculos y emociones | atlas / salon-centre | source-reader, cloud-engineering | lib/atlas-content.ts, lib/atlas-core.ts, lib/atlas-types.ts |
| domain:trabajo | Trabajo y proyectos: Herramientas para trabajo y proyectos | atlas / salon-centre | source-reader, cloud-engineering | lib/atlas-content.ts, lib/atlas-core.ts, lib/atlas-types.ts |
| domain:aprendizaje | Aprender y explorar: Herramientas para aprender y explorar | atlas / lab-desk | source-reader, cloud-engineering | lib/atlas-content.ts, lib/atlas-core.ts, lib/atlas-types.ts |
| domain:creatividad | Crear y expresarme: Herramientas para crear y expresarme | atlas / music-console | source-reader, cloud-engineering | lib/atlas-content.ts, lib/atlas-core.ts, lib/atlas-types.ts |
| domain:sentido | Sentido y perspectiva: Herramientas para sentido y perspectiva | atlas / salon-centre | source-reader, cloud-engineering | lib/atlas-content.ts, lib/atlas-core.ts, lib/atlas-types.ts |
| process:experience | Espiral de experiencia: Espiral de experiencia | atlas / mind-desk | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:suceso | Dios · Suceso: Dios · Suceso | atlas / sky-sources | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:chat | Conversación: Conversación | atlas / salon-centre | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:research | Observación de fuentes: Observación de fuentes | atlas / lab-desk | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:tools | Ion · herramientas: Ion · herramientas | atlas / body-console | source-reader, program-lab, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:review | Tribunal de refutación: Tribunal de refutación | atlas / refutation-candidate | source-reader, strategy-eval, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:video | Generación de vídeo: Generación de vídeo | atlas / cinema-projector | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:creative | Arquitecto 3D: Arquitecto 3D | atlas / games-desk | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:core | Núcleo de estrategias: Núcleo de estrategias | atlas / language-object | source-reader, strategy-eval, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:external | Perspectivas externas: Perspectivas externas | atlas / sky-sources | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:lor | Experimento LOR-ΩΣ: Experimento LOR-ΩΣ | atlas / language-symbol | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:weights | Pesos Qwen · laboratorio: Pesos Qwen · laboratorio | atlas / refutation-control | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| process:agents | Agentes programadores: Agentes programadores | atlas / sky-agents | source-reader, cloud-engineering | lib/core/process-telemetry.mjs, app/core-observatory.tsx |
| sense:image | Vista · señales de imagen: Medición visual | atlas / cinema-audience-1 | source-reader, image-features, cloud-engineering | lib/evolution/signals.ts, app/atlas-evolution.tsx |
| sense:audio | Oído · señales de audio: Medición de audio | atlas / music-mixer | source-reader, audio-features, cloud-engineering | lib/evolution/signals.ts, app/atlas-evolution.tsx |
| eras-character:ice:scout | Ara: Exploradora · ice | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:ice:warrior | Eren: Cazador · ice | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:ice:guardian | Nara: Guardiana · ice | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:bronze:scout | Tala: Mensajera · bronze | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:bronze:warrior | Aruna: Guerrero · bronze | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:bronze:guardian | Hatti: Centinela · bronze | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:greece:scout | Thaleia: Exploradora · greece | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:greece:warrior | Damon: Hoplita · greece | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:greece:guardian | Myrto: Defensora · greece | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:rome:scout | Livia: Exploradora · rome | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:rome:warrior | Marcus: Legionario · rome | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:rome:guardian | Dacia: Auxiliar · rome | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:medieval:scout | Inés: Rastreadora · medieval | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:medieval:warrior | Sancho: Hombre de armas · medieval | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:medieval:guardian | Yusuf: Guardián · medieval | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:renaissance:scout | Alba: Exploradora · renaissance | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:renaissance:warrior | Luca: Mercenario · renaissance | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:renaissance:guardian | Beatrice: Custodia · renaissance | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:industrial:scout | Ada: Exploradora · industrial | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:industrial:warrior | Émile: Tirador · industrial | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:industrial:guardian | Clara: Custodia · industrial | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:present:scout | Vera: Exploradora · present | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:present:warrior | Leo: Defensor · present | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:present:guardian | Noor: Guardiana · present | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:orbital:scout | Lyra: Exploradora · orbital | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:orbital:warrior | Orion: Operador · orbital | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:orbital:guardian | Sol: Custodia · orbital | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-character:stellar:scout | Nova: Viajera · stellar | eras / games-maquette | source-reader, cloud-engineering | dist/core.js |
| eras-character:stellar:warrior | Kael: Vanguardia · stellar | eras / body-console | source-reader, cloud-engineering | dist/core.js |
| eras-character:stellar:guardian | Iris: Guardiana · stellar | eras / refutation-candidate | source-reader, cloud-engineering | dist/core.js |
| eras-zone:ice | Edad de Hielo: El último fuego · ice | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:bronze | Edad del Bronce: La ruta del cobre · bronze | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:greece | Grecia clásica: La sombra de la polis · greece | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:rome | Imperio romano: Más allá del camino · rome | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:medieval | Edad Media: La frontera de piedra · medieval | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:renaissance | Renacimiento: La ciudad de los talleres · renaissance | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:industrial | Era industrial: El pulso del hierro · industrial | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:present | Mundo contemporáneo: El mundo que heredamos · present | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:orbital | Era orbital: Al otro lado del cielo · orbital | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-zone:stellar | Era interestelar: El eco de la humanidad · stellar | eras / games-desk | source-reader, cloud-engineering | dist/core.js, dist/world.js, dist/graphics.js |
| eras-building:workshop | Taller: workshop · campamento | eras / body-arm | source-reader, cloud-engineering | dist/core.js |
| eras-building:infirmary | Puesto de cura: infirmary · campamento | eras / body-arm | source-reader, cloud-engineering | dist/core.js |
| eras-building:store | Almacén: store · campamento | eras / body-arm | source-reader, cloud-engineering | dist/core.js |
| eras-building:barracks | Alojamiento: barracks · campamento | eras / body-arm | source-reader, cloud-engineering | dist/core.js |
| eras-building:tower | Atalaya: tower · campamento | eras / body-arm | source-reader, cloud-engineering | dist/core.js |
