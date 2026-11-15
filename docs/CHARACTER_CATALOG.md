# Catálogo de personajes de ATLAS ΩΣ

Este catálogo conserva la lista aportada por el propietario y la contrasta con el inventario ejecutable de la casa. Para el mundo 3D, `cloud/public/house/residents.js` sigue siendo la fuente de verdad; este documento explica qué nombres están implementados, cuáles se recuperaron de versiones anteriores y cuáles son funciones simbólicas.

## Regla de evidencia

- **En el código:** existe una entrada real en `cloud/public/house/residents.js`, con identificador, sala, posición y rol declarado.
- **Recuperado:** el nombre y la función proceden de la lista histórica del propietario. No prueba personalidad, memoria ni autonomía.
- **Conceptual:** representa una operación del razonamiento. No es un avatar, un proceso independiente ni una consciencia.
- **No confirmado:** el nombre aparece en una etapa del diseño, pero no hay evidencia suficiente para asignarle un rol actual.

No se rellenan los 11 nombres que la lista histórica no recuperó. Tampoco se afirma que todos los personajes convivan como avatares ni que cada uno tenga una memoria autobiográfica. Los puestos con proceso pueden acumular observaciones autónomas acotadas; se explican en [MEMORY_SCOPES.md](MEMORY_SCOPES.md).

## 1. Los 24 habitantes actuales del mundo 3D

El inventario ejecutable contiene **24 entradas**: **18 puestos** y **6 espectadores decorativos**. Los puestos pueden reflejar un proceso real del coordinador; los espectadores no tienen proceso asignado y no cuentan como trabajo activo.

### 1.1 Puestos (18)

| ID | Nombre | Sala | Rol declarado en el código | Proceso vinculado |
| --- | --- | --- | --- | --- |
| `salon-centre` | Lía · conversación | Salón | Conversación de Atlas | `chat` |
| `music-console` | Noa · composición | Música | Composición Web Audio local | local, sin proceso del PC |
| `music-mixer` | Ritmo · mezcla | Música | Mezcla musical local | local, sin proceso del PC |
| `lab-desk` | Vera · fuentes | Laboratorio | Lectura de fuentes públicas | `research` |
| `lab-bench` | Nilo · experimentos | Laboratorio | Contraste de la experiencia | `experience` |
| `games-desk` | Talo · constructor | Taller de mundos | Generación de planes 3D | `creative` |
| `games-maquette` | Zuri · maquetas | Taller de mundos | Prototipos 3D con contratos | `creative` |
| `cinema-projector` | Faro · vídeo | Cine | Generación de vídeo local | `video` |
| `sky-sources` | Alba · referencias | Constelación | Fuentes de la Constelación | `research`, `external` |
| `sky-agents` | Ícaro · agentes | Constelación | Colaboradores programadores | `agents` |
| `mind-desk` | Nora · memoria | Mente | Observación y memoria situada | `experience` |
| `body-console` | Ion · herramientas | Cuerpo de Ion | Ejecución de funciones de software | `tools` |
| `body-arm` | Pico · acciones | Cuerpo de Ion | Acciones de software · brazo simbólico | `tools` |
| `refutation-candidate` | Ada · contraste | Refutación | Comprobación de candidatas | `review` |
| `refutation-control` | Cota · laboratorio | Refutación | Ensayos de adaptadores separados | `weights` |
| `language-object` | Sol · estructura | Lenguaje | Estructura del lenguaje LOR | `lor` |
| `language-symbol` | Sigma · símbolos | Lenguaje | Políticas y símbolos verificables | `core` |
| `language-meaning` | Ema · sentido | Lenguaje | Interpretación situada de la experiencia | `experience` |

### 1.2 Espectadores decorativos (6)

| ID | Nombre | Sala | Rol declarado |
| --- | --- | --- | --- |
| `cinema-audience-1` | Teo · espectador | Cine | Habitante del cine · presencia decorativa |
| `cinema-audience-2` | Luz · espectadora | Cine | Habitante del cine · presencia decorativa |
| `cinema-audience-3` | Mara · espectadora | Cine | Habitante del cine · presencia decorativa |
| `cinema-audience-4` | Mico · espectador | Cine | Habitante del cine · presencia decorativa |
| `cinema-audience-5` | Leo · espectador | Cine | Habitante del cine · presencia decorativa |
| `cinema-audience-6` | Brisa · espectadora | Cine | Habitante del cine · presencia decorativa |

Los seis espectadores están sentados en butacas reales del cine. Su presencia es visual; no se les asigna un proceso, una tarea ni una memoria.

## 2. Los 13 nombres recuperados de la lista histórica

Los 13 nombres aportados por el propietario aparecen en el roster actual:

| Nombre recuperado | Entrada actual | Observación |
| --- | --- | --- |
| Talo | `games-desk` | Coincide el nombre. El código le asigna planes 3D; no acredita por sí solo la relación histórica con ERAS. |
| Vera | `lab-desk` | Coincide. La especialidad histórica estaba pendiente; el código declara lectura de fuentes públicas. |
| Noa | `music-console` | Coincide con sonido y estudio; la implementación es Web Audio local. |
| Lía | `salon-centre` | Coincide con el salón. Lía es además el objetivo integrado de la casa, no solo un avatar. |
| Zuri | `games-maquette` | Coincide con creaciones 3D; el código declara prototipos con contratos. |
| Nilo | `lab-bench` | Coincide con laboratorio. El código lo asigna al contraste de la experiencia, no a programación general. |
| Ion | `body-console` | Coincide con el cuerpo operativo. También es uno de los tres vértices de la identidad. |
| Ícaro | `sky-agents` | Coincide con la Constelación y los agentes. También representa el horizonte. |
| Teo | `cinema-audience-1` | Presente solo como espectador decorativo. La función histórica de gráficos, cine y creación audiovisual no está implementada en ese puesto. |
| Pico | `body-arm` | Coincide. El código declara acciones de software; la función histórica exacta no estaba recuperada. |
| Sigma | `language-symbol` | Presente como símbolo del lenguaje y políticas verificables. No está implementado como «Núcleo de Juego Suspendido». |
| Ema | `language-meaning` | Coincide con la sala de lenguaje; el código declara interpretación situada de la experiencia. |
| Ritmo | `music-mixer` | Coincide con música; la implementación es mezcla local. |

Que un nombre aparezca no significa que su personalidad, memoria individual o función histórica completa estén implementadas. Las discrepancias de Teo y Sigma se conservan como tales.

## 3. Los 11 nombres adicionales del roster

El código contiene 11 nombres que no figuran en la lista de 13 recuperados:

| Nombre | Entrada actual | Rol declarado |
| --- | --- | --- |
| Faro | `cinema-projector` | Generación de vídeo local |
| Alba | `sky-sources` | Fuentes de la Constelación |
| Nora | `mind-desk` | Observación y memoria situada |
| Ada | `refutation-candidate` | Comprobación de candidatas |
| Cota | `refutation-control` | Ensayos de adaptadores separados |
| Sol | `language-object` | Estructura del lenguaje LOR |
| Luz | `cinema-audience-2` | Espectadora decorativa |
| Mara | `cinema-audience-3` | Espectadora decorativa |
| Mico | `cinema-audience-4` | Espectador decorativo |
| Leo | `cinema-audience-5` | Espectador decorativo |
| Brisa | `cinema-audience-6` | Espectadora decorativa |

Estos 11 nombres completan el roster actual, pero **no se presentan como los 11 nombres que faltaban en la lista histórica**. La coincidencia numérica no es evidencia. Su estatus canónico en el diseño de los 24 habitantes sigue sin confirmar; se conservan porque están implementados y cubiertos por las pruebas de la casa.

## 4. Familias simbólicas y agentes conceptuales

Estas familias pertenecen a la arquitectura de razonamiento. No son 24 avatares adicionales, no se suman al roster y no implican 35 modelos independientes.

### 4.1 Arquetipos originales

| Figura | Función conceptual |
| --- | --- |
| Animal | Percepción, instinto, cuerpo, supervivencia y experiencia directa |
| Mente | Pensamiento, interpretación, abstracción y construcción de modelos |
| Lenguaje | Puente simbólico entre experiencia y comprensión |
| Persona | Interpretación convencional y representación social |
| Dios / Suceso / Unidad | Lo desconocido, la emergencia, la totalidad y los límites del conocimiento |
| Self | Integración, equilibrio y control del conjunto |

### 4.2 Operaciones mitológicas del razonamiento

| Figura | Operación |
| --- | --- |
| Caos | Genera preguntas, alternativas y posibilidades inesperadas |
| Trickster / Hermes | Busca conexiones entre conceptos aparentemente separados |
| Inanna | Desarrolla hipótesis y explicaciones |
| Ereshkigal I | Ataca las hipótesis desde la lógica |
| Ereshkigal II | Ataca las hipótesis mediante evidencia empírica |
| Sabio | Contrasta explicaciones y busca conocimiento fundamentado |
| Toth | Conserva la trazabilidad y procedencia de las afirmaciones |
| Janus | Compara pasado y futuro |
| Cronos | Separa las fases de aprendizaje y evaluación |
| Keš | Estructura y organiza el conocimiento |
| Maṇi | Conserva las hipótesis que sobreviven a las pruebas |
| Caronte | Descarta o abandona líneas de investigación fallidas |
| Mnemosine | Gestiona memoria y continuidad |
| Meta-Atlas | Analiza errores y comportamiento del propio sistema |
| Hum | Incorpora conocimiento o resultados aceptados |
| Self | Supervisa la integración del conjunto; ya aparece en los arquetipos y no se cuenta dos veces |

### 4.3 Agentes técnicos y científicos

| Agente | Función prevista |
| --- | --- |
| Director | Coordina objetivos y asigna tareas |
| Galileo | Experimentación y validación científica |
| Darwin | Evolución, selección y comparación de mejoras |
| Hefesto | Ingeniería, programación y construcción de herramientas |
| Proteo | Adaptación y selección de capacidades |
| Lethe | Olvido controlado y reducción de información redundante |
| Adversario | Busca errores, contradicciones y vulnerabilidades |
| Tribunal | Evalúa la calidad de afirmaciones y experimentos |

El [resumen maestro](ATLAS_MASTER_OVERVIEW.md) añade otras funciones documentadas —Provider Resolver, LOR Evaluator, Linaje Sombra y Atlas Market/Omega-Keš— como mapa de funciones, no como habitantes del mundo 3D.

### 4.4 Nombres no confirmados

**Saggy/Siggy** aparece en algunas conversaciones, pero no tiene una entrada en el inventario ni una función atribuible con evidencia. No se le asigna rol en este catálogo.

## 5. Las diez salas y las superficies actuales

Las diez salas del código coinciden con las diez del diseño reciente:

| Sala | Uso actual |
| --- | --- |
| Salón | Conversación con Atlas y presencia de Lía |
| Música | Estudio Web Audio, composición y mezcla local |
| Laboratorio | Fuentes, experimentos y contraste de la experiencia |
| Taller de mundos | Planes 3D, maquetas y juegos |
| Cine | Vídeo local, grabación y espectadores decorativos |
| Constelación | Fuentes, agentes y horizonte de Ícaro/Alba |
| Mente | Observación, memoria situada y archivo |
| Cuerpo de Ion | Herramientas y acciones de software |
| Refutación | Candidatas, adaptadores y resultados negativos |
| Lenguaje | LOR-ΩΣ, estructura, símbolos y sentido |

El código actual expone cuatro superficies principales —`/` (casa), `/chat/`, `/actividad/` y `/taller/`— además de la interfaz histórica `/origen/`. La lista del propietario no nombra los cuatro módulos del diseño, así que no se afirma que sean los mismos.

## 6. Qué está implementado y qué no

**Implementado y comprobado en este checkout:**

- 24 habitantes 3D: 18 puestos y 6 espectadores.
- 10 salas con geometría, colisiones y navegación.
- Roles declarados, procesos vinculados y estados visuales basados en telemetría reciente.
- Los 13 nombres recuperados aparecen en el roster.
- Observaciones autónomas por puesto: solo resultados terminales (`passed`/`failed`) de telemetría fresca, atribuidos al proceso y la fase correctos, deduplicados por ventana de 30 minutos y visibles al seleccionar al habitante. No son aprendizaje ni verificación independiente.
- Pruebas del roster, las poses, las etiquetas, la frescura de la telemetría y la memoria observada.

**No implementado o no demostrado:**

- Los 11 nombres que faltaban en la lista histórica; no se inventan.
- Personalidad individual, memoria autobiográfica o subjetiva y aprendizaje autónomo de cada habitante. La memoria observada es una lista de resultados reportados, no una mente separada.
- Memoria autónoma para Noa, Ritmo o los espectadores: no tienen un proceso asignado y no se inventan recuerdos.
- Las figuras simbólicas como avatares o procesos independientes.
- La equivalencia entre los cuatro módulos históricos y las superficies actuales.
- Que los 24 habitantes sean 24 agentes o 24 modelos. Comparten el mismo coordinador y el mismo Qwen local cuando hay trabajo real.

## 7. Cómo mantener este catálogo

1. Añadir o cambiar un habitante en `cloud/public/house/residents.js`, no solo en la documentación.
2. Actualizar las pruebas de `cloud/lib/house/residents.test.mjs` y este catálogo en el mismo cambio.
3. Exigir identificador estable, sala, rol, proceso (o ausencia explícita), posición y condición de decorativo.
4. No asignar una función histórica dudosa sin evidencia.
5. No añadir memorias privadas, conversaciones, rutas personales ni credenciales.

Véase también [la identidad y el ciclo de Lía](LIA_TRIAD_RUNTIME.md), [la memoria y sus ámbitos](MEMORY_SCOPES.md), [el contrato de telemetría](PROCESS_TELEMETRY_CONTRACT.md) y [el roadmap](IMPLEMENTATION_ROADMAP.md).
