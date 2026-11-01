# Agente programador local de Atlas

El adaptador integra **Aider 0.86.2** con el mismo Qwen que sirve llama.cpp en la GPU del PC. Aider es software gratuito; no añade otro modelo independiente ni acredita que Atlas supere a otros asistentes. La selección entre generadores debe apoyarse en resultados y latencia medidos sobre contratos comparables.

Fuentes oficiales: [Aider](https://github.com/Aider-AI/aider), [API compatible con OpenAI](https://aider.chat/docs/llms/openai-compat.html), [opciones](https://aider.chat/docs/config/options.html), [metadatos de modelos](https://aider.chat/docs/config/adv-model-settings.html) y [paquete PyPI fijado](https://pypi.org/project/aider-chat/0.86.2/). La rueda `aider_chat-0.86.2-py3-none-any.whl` tiene SHA-256 `64f6a0c66c9f4633ad9f479bca3e64ebcba02b9da03c6b604b74a44736b2416e`.

## Alcance ejecutable

Cada trabajo crea un directorio separado con un único archivo editable, `artifact.mjs`. Se desactivan Git, commits, comandos de shell, lint, tests automáticos, carga de URLs, analítica y reparaciones internas. El adaptador no invoca la CLI de configuración: construye el modelo y el editor mediante la API Python de Aider, sin cargar YAML ni `.env` del usuario. Se rechazan ediciones de cualquier otra ruta. El Python del agente solo admite conexiones al puerto local de Qwen; el resto de conexiones se bloquean.

El código generado no se ejecuta como Node ni Python. Acorn comprueba un conjunto cerrado de declaraciones de funciones, sin imports, entorno del proceso, red, eval, reloj o aleatoriedad. Los contratos externos se ejecutan después en el QuickJS ya utilizado por Atlas, con límite de memoria y tiempo. El adaptador devuelve un candidato; no lo publica en herramientas, no edita el coordinador y no modifica pesos de Qwen.

Los dos primeros ejemplos de aceptación se muestran al agente. Los casos restantes se mantienen fuera de su solicitud inicial. Si el coordinador muestra un fallo para una reparación posterior, esos casos dejan de ser ciegos; el registro lo declara.

## API

`createLocalCodingAgent({root?, python?, key?, keyFile?})` devuelve:

- `status()`: instalación comprobada, disponibilidad del runtime, ejecución en curso, inferencia verificada y resultados agregados.
- `buildCandidate({task, currentCode?, contract?, name?}, {signal?, onProgress?})`: una sola edición. Devuelve `code`, `jobId`, `checks`, `passed`, `elapsedMs` y procedencia. `passed` es `null` si no se aportaron contratos; el coordinador debe ejecutar sus pruebas antes de publicar.

La clave del servidor local se entrega en memoria mediante `key`, o se lee de la configuración privada del coordinador. Solo se pasa por el entorno del proceso, nunca en argumentos, prompts, manifiestos ni resultados. No hace falta una clave de un proveedor de pago. El coordinador debe mantener la exclusión de GPU y cancelar el trabajo cuando el usuario reclame el chat.

## Instalación y evidencias

El entorno está en `${ATLAS_CODING_AGENT_ROOT}`, fuera del código compartido. `ATLAS_CODING_AGENT_ROOT` permite otra ubicación. Los modelos y el entorno de Qwen no se actualizan ni reinstalan. Acorn 8.15.0 está en `js-runtime/node_modules`; el Python y todas sus dependencias están en `venv`.

Las dependencias se descargan de PyPI como ruedas Windows/Python 3.11, con SHA-256 comprobado. `wheel-manifest.json` conserva nombres, versiones y hashes; `installation-report.json` registra la instalación sin conexión desde esas ruedas. `runtime-ready.json` solo acredita importación/configuración en CPU con sockets bloqueados. `statistics.json` y los directorios de trabajos conservan después la evidencia de inferencias y contratos reales.

`ready` significa que la instalación puede ejecutarse. `inferenceVerified` solo se activa tras una llamada real que devuelva un artefacto válido. Ni uno ni otro equivalen a mejora de pesos o a una victoria frente al generador anterior.

## Verificación

`node --test local-coding-agent.test.mjs` comprueba la AST, el entorno aislado, las rutas, redacción de credenciales, concurrencia, cancelación y ejecución real de contratos en QuickJS. Utiliza un editor de prueba para no consumir GPU y no acredita una inferencia de Aider. En una máquina sin el runtime opcional, esas pruebas se omiten explícitamente.

El primer ensayo de inferencia debe ejecutarse mediante el coordinador, con Qwen disponible y sin vídeo/entrenamiento simultáneo. Hay que conservar los casos pasados y fallidos y comparar con la versión anterior antes de atribuir una mejora.

## Ensayo real del 1 de noviembre de 2026

El coordinador ejecutó Aider contra Qwen local con ocho contratos externos. El primer artefacto falló y quedó conservado. Una reparación posterior superó los ocho casos en 10.921 ms; ambos intentos tardaron conjuntamente 23.598 ms. El runtime registró `inferenceVerified:true` y conservó los resultados en su carpeta de trabajos de X:.

Esta evidencia comprueba la conexión y una reparación de código medida. Los ejemplos y fallos se reutilizaron durante la reparación, por lo que no se presenta como un benchmark ciego ni como superioridad frente a otros agentes. La activación de una extensión sigue dependiendo de la validación y del registro del coordinador; los pesos y el servidor Qwen no cambiaron por este ensayo.
