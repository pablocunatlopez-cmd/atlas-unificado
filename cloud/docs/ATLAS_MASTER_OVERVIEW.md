# ATLAS ΩΣ — documento maestro del proyecto

**Marco de identidad, investigación y evolución · reconstrucción aportada por el propietario, noviembre de 2026**

> Este documento conserva la visión que el propietario describe para Atlas y la separa de la implementación comprobada en este repositorio. Los hitos históricos que aparecen aquí son contexto de transferencia aportado por el propietario; no equivalen a una auditoría de artefactos, commits, modelos entrenados o resultados reproducibles. Para declarar una capacidad «implementada» se necesita localizar su código y ejecutar su verificación.

## 1. Identidad y propósito

Atlas es un proyecto experimental de inteligencia artificial que busca integrar cinco dimensiones:

1. **Epistemología computacional:** representar cómo se obtiene, justifica, corrige y refuta el conocimiento.
2. **Inteligencia neuronal propia:** desarrollar ATLAS-LM como modelo lingüístico entrenable y ejecutable localmente.
3. **Razonamiento simbólico y matemático:** usar LOR-ΩΣ para representar objetos, contextos, relaciones, transformaciones, escalas e invariantes.
4. **Evolución del software:** detectar limitaciones, proponer cambios, probarlos de forma aislada y conservar solo los que demuestren utilidad.
5. **Continuidad histórica:** mantener memoria, procedencia, decisiones, errores, experimentos, versiones y preguntas abiertas.

La aspiración es que Atlas pueda investigar problemas, formular hipótesis, elegir herramientas y evaluar resultados, no solo responder a una entrada. Esto no demuestra inteligencia general ni conciencia; son afirmaciones distintas que requerirían evidencia propia.

En la visión actual del producto, **Atlas es la mente, Ion el cuerpo y Dios/Ícaro/Cielo/Constelación el horizonte de fuentes y agentes; Lía es el objetivo integrado al que sirven**. La casa y sus salas son entornos de desarrollo de Lía. Los especialistas amplían ese sistema; sus nombres o animaciones no prueban autonomía.

## 2. Constitución epistemológica

Los procesos de Atlas deberían obedecer a estos principios:

- **Realidad:** una afirmación no se vuelve hecho por sonar convincente o encajar con una teoría.
- **Procedencia:** conservar fuente, método, contexto y fecha cuando estén disponibles.
- **Falsabilidad:** buscar activamente qué observación invalidaría una hipótesis.
- **Incertidumbre:** dejar explícitos los datos ausentes y las explicaciones alternativas.
- **Conservación:** mantener versiones recuperables y no destruir sin respaldo un estado estable.
- **Aprendizaje verificable:** medir cambios en tareas relevantes; no equiparar actividad con progreso.
- **Autoridad limitada:** un agente no puede otorgarse permisos ni reescribir por sí solo sus reglas de seguridad.
- **Continuidad:** conservar errores, refutaciones y decisiones con su contexto.
- **Independencia progresiva:** las herramientas externas pueden apoyar la investigación, pero el objetivo de largo plazo es aumentar capacidades propias.

## 3. LOR-ΩΣ: marco de representación experimental

LOR-ΩΣ pretende ofrecer un lenguaje común para describir fenómenos de diferentes disciplinas sin afirmar de antemano que sean equivalentes. Los componentes que el proyecto quiere representar incluyen:

| Componente | Pregunta que representa |
|---|---|
| Objeto | ¿Qué se estudia? |
| Ambiente | ¿En qué condiciones existe? |
| Observador e instrumento | ¿Quién o qué mide, y cómo? |
| Estado | ¿Qué propiedades se observan? |
| Relaciones | ¿Cómo interactúa con otros elementos? |
| Transformaciones | ¿Cómo cambia? |
| Restricciones | ¿Qué cambios son posibles? |
| Invariantes | ¿Qué permanece bajo una transformación especificada? |
| Escala y medida | ¿A qué nivel se observa y con qué instrumento? |
| Historia | ¿Qué trayectoria llevó al estado actual? |
| Predicción y falsador | ¿Qué debería ocurrir y qué refutaría la propuesta? |

El marco contextual se expresa como `K = ⟨O, A, V, E⟩`, donde `O` es objeto, `A` ambiente, `V` observador y `E` escala. Es una representación conceptual del proyecto, no una ley física universal validada. Las líneas sobre memoria de trayectoria, cambios de régimen, transporte entre contextos, curvatura y holonomía deben conservarse como hipótesis de investigación hasta que tengan definiciones operativas y validación.

Regla de investigación: **`NO_UNIFICATION_WITHOUT_INVARIANT`**. Una analogía o similitud estadística puede inspirar una pregunta; no basta para declarar una unificación. Hay que especificar dominio, transformación, invariantes, predicción y prueba.

La semiosis `Objeto → Signo → Interpretante` expresa cómo algo se representa y adquiere significado para un observador. Fibonacci, espirales y trayectorias pueden ser modelos o metáforas útiles, pero no se deben presentar como leyes universales sin evidencia.

## 4. Espiral de aprendizaje

El ciclo conceptual es:

1. **Observar:** registrar información del mundo, del usuario o del sistema.
2. **Comprender:** construir una representación explícita.
3. **Conectar:** buscar relaciones con conocimiento existente y sus fuentes.
4. **Aplicar:** proponer una predicción, solución, programa o experimento.
5. **Refutar:** buscar contraejemplos y probar condiciones de fallo.
6. **Aprender:** integrar únicamente los cambios que superen los criterios definidos.

Cada ciclo conserva historia y puede abrir preguntas nuevas. Para evitar una proliferación de tareas sin resolver, la espiral necesita prioridades, límites de recursos, cancelación y condiciones de terminación.

## 5. Tribunal, evidencia y tipos de afirmación

El Tribunal debe distinguir, como mínimo:

- **Hecho verificado:** respaldado por evidencia reproducible y pertinente.
- **Inferencia:** conclusión derivada de premisas identificables.
- **Hipótesis:** propuesta pendiente de prueba.
- **Metáfora:** representación conceptual que no debe confundirse con explicación científica.
- **Desconocido o refutado:** evidencia insuficiente o prueba contraria.

La revisión debe buscar errores, premisas ocultas, explicaciones alternativas y pruebas que puedan fallar. Un consenso entre varios agentes no convierte una afirmación en verdad. Las perspectivas pueden ser funciones deterministas, herramientas o modelos; el número de personajes tampoco indica cuántas IA independientes existen.

Los tribunales previstos cubren evidencia, lógica, matemática, causalidad, adversarialidad, experimentación, regresión y seguridad. Su integración y alcance actuales deben verificarse componente por componente.

## 6. Memoria y aprendizaje negativo

La visión contempla memorias episódica, semántica, procedimental, causal, experimental, negativa, histórica, autobiográfica y prospectiva. Una memoria negativa útil no es una lista descontextualizada: conserva la hipótesis, las condiciones de la prueba, la evidencia de fallo, la decisión tomada y qué nueva evidencia justificaría reabrir el caso.

Un cambio de software solo debería declararse mejora si aporta evidencia nueva, mejora una métrica definida, conserva capacidades importantes, supera pruebas frente a la versión previa y puede revertirse. La actualización de memoria externa, la modificación de código y el entrenamiento de pesos neuronales son clases diferentes de cambio y deben medirse por separado.

Mnemosine y Lethe son nombres de funciones previstas para conservar y reducir ruido, respectivamente; su mención no prueba que existan como procesos integrados.

## 7. Atlas Genesis y ATLAS-LM: contexto histórico comunicado

El propietario describe **Atlas Genesis v0.4**, en julio de 2026, como una línea que habría reunido un daemon persistente, SQLite, compilación epistemológica, relaciones, transformaciones causales, detección de contradicciones, generación de hipótesis, agenda, interfaz y checkpoints. En el resumen histórico se comunicaron cifras de una ejecución: 12 ciclos, 115 afirmaciones, 214 relaciones, 230 preguntas, 36 contradicciones candidatas, 12 hipótesis y 48 tareas de agenda, además de transformaciones y comprobaciones `SMOKE_OK`/`GENESIS_OK`.

Estas cifras describen un registro histórico comunicado por el propietario. No demuestran por sí mismas la validez de las relaciones, la calidad de las hipótesis, el estado actual del código ni inteligencia general. Antes de citarlas como resultados reproducibles, localizar el artefacto original, el commit, los datos, los comandos y las pruebas.

También se describe **ATLAS-LM v0.1** como un prototipo PyTorch de Transformer causal con tokenización byte-level, entrenamiento de siguiente token, checkpoints, conversación local y recolección de datos con procedencia. Un modelo pequeño entrenable demuestra una ruta experimental, no competencia conversacional avanzada.

**ATLAS-SL** es la aspiración de una representación interna estructurada; hace falta comprobar qué gramática, intérprete, validación y compatibilidad están implementados. Entrenar Qwen u otro modelo auxiliar no equivale a entrenar ATLAS-LM ni a demostrar independencia neuronal.

## 8. Versiones históricas, Q593/Q594 y autoridad

El propietario comunica distintas líneas —Genesis, Atlas 5.x, Atlas 5.9.9, Atlas 5.7/Q594 y Atlas Unificado— que no deben suponerse una secuencia lineal de un solo programa.

Como contexto histórico se mencionan 45 fichas científicas y 113 pruebas para Atlas 5.9.9, e iteraciones V1–V20, hasta 135 intentos de prueba, bloqueos y fixtures para Atlas 5.7/Q594. No se debe convertir el número de intentos en número de éxitos ni de pruebas aprobadas. El enunciado canónico completo de Q594 no está incluido aquí; no inventarlo.

La investigación de autoridad considera hashes, firmas, quórum, árboles Merkle, transacciones, snapshots, rollback, inyección de fallos y migraciones. Sus límites son importantes: una regla del prompt no es una barrera del sistema operativo; un quórum local no equivale automáticamente a consenso distribuido; una transacción confirmada no acredita por sí sola todas las garantías ante fallos físicos; revocar un permiso lógico puede no cerrar descriptores abiertos. Cada garantía requiere un modelo de amenaza y una prueba concreta.

## 9. Autoevolución y Linaje Sombra

El flujo previsto es detectar una limitación → investigar → crear una candidata en rama/entorno aislado → ejecutar pruebas externas al generador → buscar regresiones y contraejemplos → comparar con la versión estable → solicitar autorización cuando corresponda → promover o revertir → registrar la decisión.

El **Linaje Sombra** es la propuesta de conservar experimentos y ramas candidatas sin sustituir prematuramente la versión estable. Un registro útil debería incluir identificador, padre, hipótesis, cambios, entorno, comandos, pruebas, benchmarks, regresiones, evidencias, aprobación y disponibilidad de rollback. El formato de ese manifiesto debe coincidir con el esquema real antes de integrarlo.

Proponer código no equivale a ejecutarlo; pasar tests locales no acredita seguridad general; modificar software no demuestra aprendizaje de pesos. La autoridad que ejecuta, el evaluador y quien autoriza la promoción deben tener responsabilidades separadas.

## 10. Agentes conceptuales

El propietario ha propuesto los nombres Director, Galileo, Darwin, Hefesto, Mnemosine, Lethe, Toth, Proteo, Tribunal, Adversario, Provider Resolver, LOR Evaluator, Linaje Sombra y Atlas Market/Omega-Keš. Se entienden como mapa de funciones, salvo prueba de implementación individual. El [catálogo de personajes](CHARACTER_CATALOG.md) separa estas funciones de los 24 habitantes del mundo 3D y documenta sus solapamientos.

| Función | Responsabilidad prevista |
|---|---|
| Director | Prioridad y coordinación |
| Galileo | Método experimental y medición |
| Darwin | Comparación de candidatas |
| Hefesto | Ingeniería y programación aislada |
| Mnemosine / Lethe | Consolidación / reducción controlada de ruido |
| Toth / Proteo | Representación / selección de capacidades |
| Tribunal / Adversario | Evaluación / búsqueda activa de fallos |
| Provider Resolver | Selección acotada de motores y herramientas |
| Linaje Sombra | Trazabilidad de experimentos |
| Atlas Market | Línea de investigación financiera separada |

No se necesitan modelos independientes para cada función. Con hardware limitado, muchas pueden ser programas ordinarios y usar un único modelo compartido, con concurrencia controlada.

## 11. Infraestructura y acceso

La visión apunta a ejecución local, una GPU RTX 3060 con 12 GB, acceso remoto desde móvil, coste cero en APIs comerciales para el uso ordinario y almacenamiento pesado preferente en `X:\ATLAS_DATA`. Son objetivos comunicados, no valores que deban darse por presentes en cada instalación.

Python/PyTorch/CUDA, Ollama o Transformers, SQLite, Git, Docker y una interfaz web son tecnologías consideradas. Deben verificarse las versiones, rutas, modelos, límites de VRAM, permisos y estado real del puente antes de diagnosticar la instalación.

La conexión remota requiere autenticación, transporte cifrado, aislamiento por usuario, autorización en el servidor y secretos fuera del cliente. El acceso a Internet, Reddit, documentación y repositorios debe tratar las fuentes como datos no confiables, con procedencia y protección frente a instrucciones incrustadas.

## 12. ERAS y Atlas como asistente

ERAS · Crónicas de la Humanidad es una aplicación relacionada: simulación histórica, personajes, entornos 3D y herramientas creativas. Puede servir como campo de pruebas para agentes y generación de software, pero alcanzar calidad AAA exige motores, arte, animación, contenido y optimización específicos; una arquitectura lingüística no lo garantiza.

Atlas también busca ser un asistente interdisciplinar para ciencia, programación, datos, ingeniería, creación y organización. Debe decir si no ejecutó código, no consultó una fuente o no realizó una prueba. La respuesta textual no debe fingir una acción externa.

## 13. Estado comunicado frente a estado del repositorio

Este cuadro evita presentar objetivos históricos como funcionalidades actuales. El propietario comunica prototipos y pruebas para varias líneas, pero **este documento no audita sus artefactos originales**. El repositorio actual sí contiene módulos y tests concretos que deben revisarse por ruta y ejecutarse antes de atribuirles capacidades.

| Línea | Contexto comunicado | Qué falta para afirmarlo como capacidad actual |
|---|---|---|
| Genesis | Daemon, memoria, agenda, ciclos | Artefacto original, ejecución reproducible y evaluación de calidad |
| ATLAS-LM | Transformer pequeño, entrenamiento y checkpoints | Pesos, configuración, dataset, métricas y comparación independiente |
| Atlas 5.9.9 | Fichas y batería de pruebas | Commit, alcance de tests, resultados y límites |
| Atlas 5.7/Q594 | Pruebas de autoridad y persistencia | Enunciado Q594, fixtures, resultados y modelo de amenaza |
| LOR-ΩΣ | Formalismo y componentes experimentales | Gramática, implementación, invariantes y predicciones validadas |
| Autoevolución | Propuesta de rama, test y promoción | Ciclo completo con aislamiento, aprobación, rollback y auditoría |
| Local/Sites/ERAS | Arquitectura objetivo | Auditoría de integración, configuración y pruebas end-to-end |

## 14. Medición del progreso

Actividad no es progreso. Atlas debería mantener evaluaciones separadas para lenguaje, matemáticas, programación, memoria, aprendizaje, generalización, autonomía, seguridad, eficiencia e investigación. Los conjuntos de evaluación deben ser independientes de los datos de entrenamiento, versionados y reproducibles.

Una iteración útil debe informar el resultado antes/después, tamaño de muestra, incertidumbre, latencia, memoria/VRAM, coste energético cuando pueda medirse, regresiones y condiciones de validez. Una mejora aislada no demuestra superioridad general frente a GPT, Claude, Grok o sistemas futuros. Esa comparación necesita tareas y métricas públicas y no permite concluir superioridad universal.

## 15. Prioridades de integración

1. Identificar cuál código es canónico y mapear prototipos históricos a rutas, ramas y commits.
2. Definir contratos/versiones entre identidad, LOR-ΩΣ, memoria, Tribunal, modelo y herramientas.
3. Separar tests de código, tests de capacidades del modelo y evaluaciones epistemológicas.
4. Crear pruebas reproducibles para permisos, aislamiento, cancelación, rollback y acceso remoto.
5. Unificar inventario de identidades con la casa y asociar cada rol a procesos reales; no inventar funciones por nombre.
6. Implementar una cola limitada y observable solo si el coordinador soporta leases, deduplicación, cancelación y presupuesto.
7. Evaluar ATLAS-LM separadamente de Qwen y de memoria externa.
8. Promover mejoras únicamente con criterios definidos de antemano y autorización apropiada.

## Definición de transferencia

Atlas es un sistema experimental que aspira a combinar modelo neuronal propio, representación simbólica LOR-ΩΣ, memoria histórica, evaluación adversarial y evolución controlada del software. La espiral transforma observaciones en hipótesis, pruebas, herramientas y nuevas preguntas. Cada afirmación sobre capacidades debe distinguir intención, diseño, implementación y resultado reproducible. Atlas no debe declarar comprensión o mejora cuando no puede mostrar cómo lo sabe, qué cambió y qué prueba podría refutarlo.

**Idea unificadora:** cambiar lo que sabe sin perder el rastro de cómo llegó a saberlo; generar hipótesis sin confundirlas con hechos; mejorar capacidades sin destruir las que funcionaban; y reconocer los límites de su comprensión.
