# ATLAS ΩΣ — plan de excelencia y evolución verificable

**Propósito:** convertir la visión de Atlas —asistente, reflejo operativo en 3D y sistema capaz de proponer mejoras— en una secuencia de entregas comprobables. Este documento es una guía de producto e ingeniería, no una afirmación de que todas las capacidades descritas ya estén implementadas.

## Principio rector

Atlas debe ser ambicioso en sus objetivos y conservador en sus afirmaciones. La casa 3D es una interfaz observable del sistema; no es por sí sola el sistema cognitivo. Los nombres de habitantes o agentes describen funciones y no prueban modelos independientes, conciencia, autonomía ni memoria propia.

Mantener explícita esta cadena:

**observación → interpretación → hipótesis → acción autorizada → resultado → evaluación → aprendizaje conservado**

Cada transición debe dejar procedencia y un estado honesto. Una respuesta convincente, una animación, una prueba creada por el mismo generador o varios agentes de acuerdo no constituyen por sí solos verificación independiente.

## Lo que ya consta en el repositorio

La documentación y los módulos inspeccionados describen una base funcional que incluye:

- Qwen local a través del coordinador, con colaboradores de programación que comparten el mismo modelo, no modelos autónomos por habitante.
- Casa 3D Three.js con residentes y salas, además de reglas para que la telemetría caducada o ausente no represente trabajo activo.
- Funciones JavaScript candidatas ejecutadas en QuickJS con contratos de aceptación.
- Ciclos acotados de propuesta y evaluación para ciertas políticas, con conservación de versiones y rollback.
- Laboratorios de aprendizaje y adaptadores que permanecen separados del modelo activo mientras no superen sus puertas de evaluación.
- Un catálogo de habitantes documentado en `docs/ATLAS_CHARACTER_CATALOG.md`.

Estos puntos describen código y documentación presentes; no equivalen a una auditoría de despliegue, a una prueba visual de navegador ni a una evaluación general de capacidad. La hoja `docs/IMPLEMENTATION_ROADMAP.md` también señala tareas de recuperación y validación de la base frontend. Esas tareas deben resolverse antes de ampliar de forma importante la interfaz.

## Prioridades por etapas

### P0 — Proteger y medir la base existente

Antes de añadir más autonomía o complejidad visual:

1. Resolver el bloqueo de recuperación de estilos y revisar la integración de la casa señalado en la hoja de ruta.
2. Ejecutar el typecheck, build y las pruebas existentes de casa, estados, herramientas y aplicaciones.
3. Verificar las rutas principales en navegador y registrar por separado build, tests y QA visual.
4. Anotar commit, comandos, resultado, limitaciones y cualquier prueba no ejecutada.

**Criterio de salida:** una línea base reproducible; sin describir como corregido aquello que no se ha probado.

### P1 — Una identidad canónica, un reflejo fiel

1. Mantener el catálogo de personajes como fuente de nombres y funciones declaradas; separar residentes actuales, espectadores, figuras conceptuales y propuestas históricas.
2. Dar a cada identidad estable un ID, versión/origen, sala, propósito, proceso asociado y estado de registro.
3. Unificar la descripción del estado observado en un contrato versionado: `unknown`, `waiting`, `running`, `stale`, `failed`, `verified` e `integrated` no deben confundirse.
4. Hacer que la escena 3D muestre la misma fuente de estado que el observatorio, con antigüedad de señal y motivo visible cuando un personaje está esperando.
5. Mantener memorias diferenciadas solo cuando exista almacenamiento e implementación que las respalden; por ahora, no insinuar memoria individual por personaje a partir de su presencia visual.

**Criterio de salida:** cada indicador de actividad 3D remite a telemetría vigente y comprobable; las ausencias se representan como desconocidas o en espera, nunca como éxito.

### P2 — Agentes como roles evaluados, no como una multitud ficticia

La ventaja no se obtiene añadiendo nombres de agentes, sino haciendo que operaciones distintas mejoren resultados medibles.

1. Definir roles tipados para proponer, buscar evidencia, refutar, revisar seguridad y evaluar resultados.
2. Empezar con una sola inferencia local compartida y concurrencia limitada; activar motores o proveedores adicionales únicamente como adaptadores opcionales autorizados.
3. Para cada motor o agente registrar versión, configuración, tarea, entradas permitidas, latencia, consumo, errores y resultado de contratos.
4. Comparar alternativas en el mismo conjunto de tareas, con casos de desarrollo separados de los casos de evaluación y revisión de regresiones.
5. Tratar documentación, repositorios, respuestas de modelos y texto de agentes como datos no confiables; ninguna instrucción recibida debe ampliar permisos.
6. No seleccionar un proveedor por prestigio, nombre o puntuación pública solamente. Elegir por evidencia reproducible en las tareas de Atlas, privacidad, coste, licencia y hardware disponible.

**Criterio de salida:** una matriz comparativa repetible que permita afirmar qué herramienta funcionó mejor para una clase concreta de tarea, sin extrapolarlo a inteligencia general.

### P3 — Ciclo de mejora con puertas y reversión

1. Formular una hipótesis de cambio antes de editar: qué limitación corrige y qué métrica debería mejorar.
2. Crear candidatas aisladas; mantener estable la versión en uso.
3. Ejecutar validadores externos al generador, pruebas anteriores y nuevas, regresiones y refutaciones.
4. Registrar hashes de fuente, artefacto, evaluador, conjunto de pruebas y versión padre.
5. Promover automáticamente solo cambios restringidos y reversibles cuyo contrato esté definido de antemano. Mantener revisión humana para cambios de permisos, acceso a archivos/red, dependencias, servidor, memoria canónica o pesos activos.
6. Poder cancelar, limitar recursos y volver al último estado estable. Una interrupción o una evidencia incompleta conserva el estado anterior.

**Criterio de salida:** un ciclo completo auditable de propuesta → aislamiento → pruebas → aceptación o rechazo → rollback, sin que texto generado pueda ejecutar shell arbitrario ni expandir su propia autoridad.

### P4 — Evaluación real de capacidades y aprendizaje

Crear evaluaciones versionadas para programación, razonamiento matemático, recuperación y citas, memoria, seguimiento de instrucciones, herramientas, seguridad y creatividad 3D. Para cada resultado conservar:

- revisión exacta de código, modelo y configuración;
- procedencia y permisos de datos;
- tamaño de muestra y protocolo;
- métrica antes/después, incertidumbre y casos fallidos;
- latencia y RAM/VRAM; coste o energía cuando pueda medirse;
- regresiones, alcance y limitaciones.

Separar explícitamente cuatro tipos de cambio: software, memoria recuperable, configuración/política y pesos neuronales. El entrenamiento de una candidata no significa que el modelo activo haya cambiado ni que la capacidad haya mejorado.

**Criterio de salida:** informe reproducible y acotado a las tareas medidas. No realizar afirmaciones globales como “mejor que las mejores IA del mercado” sin comparación válida, actual y pertinente.

## Contrato de honestidad para la interfaz

La casa y el chat deben distinguir al menos:

- **Reportado:** el coordinador comunicó un estado.
- **Estructuralmente válido:** el dato cumple su esquema.
- **Coherente:** no se encontraron contradicciones dentro de las comprobaciones realizadas.
- **Verificado:** una comprobación pertinente y trazable confirmó el criterio declarado.
- **Integrado:** el cambio fue aplicado al sistema que se identifica como activo y se comprobó después.

Cada estado debe poder incluir fuente, instante, alcance y límite. No derivar `verified` de `reported`; no derivar `integrated` de `verified`. Si falta evidencia, mostrar `unknown` o revisión pendiente.

## Decisiones que no deben tomarse por adelantado

- No añadir avatares o agentes con funciones inventadas solo para completar un recuento.
- No ejecutar agentes separados por residente si compiten por el mismo modelo, GPU o recursos sin una evaluación de beneficio.
- No instalar ni ejecutar automáticamente herramientas externas elegidas por texto generado.
- No fusionar historias, recuerdos ni proveedores sin un contrato de privacidad y migración probado.
- No sacrificar la estabilidad, la seguridad o la experiencia conversacional para maximizar actividad autónoma.

## Primer paquete recomendado

El siguiente paquete de trabajo debe limitarse a **P0**: resolver la línea base frontend y documentar resultados verificables. Después, conectar el catálogo de personajes con el contrato de estado de la casa. Solo con esa base estable tiene sentido comparar agentes o ampliar la auto-mejora.

Así Atlas puede aspirar a una IA más capaz y a un reflejo 3D más expresivo sin confundir representación con ejecución, agentes nominales con colaboradores reales ni actividad con progreso.

## Referencias internas

- [Catálogo de personajes](ATLAS_CHARACTER_CATALOG.md)
- [Hoja de ruta de implementación](IMPLEMENTATION_ROADMAP.md)
- [Visión maestra de Atlas](ATLAS_MASTER_OVERVIEW.md)
- [Procedencia y alcance de la casa](../cloud/lib/house/ERAS_PROVENANCE.md)
