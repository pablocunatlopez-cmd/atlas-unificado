# Atlas · código compartible

Asistente general local con chat Qwen, fuentes públicas, biblioteca GitHub, refutación, funciones JavaScript aisladas y prototipos. Su interfaz móvil es una casa 3D basada en ERAS, con diez salas: conversación, música, laboratorio, juegos, cine, constelación, mente, Ion, refutación y lenguaje. Esta distribución conserva el código y sus pruebas; excluye claves, conversaciones, memoria privada, pesos Qwen, checkpoints y datos de entrenamiento privados del equipo de origen. `cloud/` conserva seis semillas documentales o experimentales ya publicadas en Sites y dos fuentes JavaScript de runtime, incluido el pequeño MLP original necesario para compilar su interfaz histórica.

## Ejecutar localmente

1. Instala Node.js 22.20 o posterior y ejecuta `npm install`, después `npm run setup`.
2. Configura llama.cpp por separado, con un modelo GGUF que tengas derecho a usar, alias `atlas-local`, puerto local `11435` y `--api-key-file continuous/data/chat-local.key`. Los modelos no se descargan ni redistribuyen con este repositorio.
3. Ejecuta `npm start` y abre `http://127.0.0.1:8788/chat/`. El servidor principal permanece limitado al propio ordenador. En Windows, los lanzadores PowerShell pueden iniciar el supervisor si colocas llama.cpp en `llama/` y el GGUF esperado en `models/`; para otros nombres, adapta `continuous/Start-Chat.ps1`.
4. Ejecuta `npm test` para las pruebas locales. Las pruebas Python son independientes y pueden requerir PyTorch.

La instalación arranca con memoria vacía, sin claves externas y sin pesos del laboratorio. `continuous/config.example.json` contiene las fuentes públicas iniciales. La configuración local `continuous/config.json` y `continuous/data/` están ignoradas por Git. No publiques esas carpetas.

Las variables opcionales `ATLAS_LAB_PYTHON` y `ATLAS_GAMES_ROOT` seleccionan el intérprete del laboratorio y una carpeta de juegos autorizada. `ATLAS_GPU_PYTHON` puede fijar la ruta del entrenador experimental al crear por primera vez la configuración; el backend inicial sigue siendo CPU. `ATLAS_LOR_PYTHON`, `ATLAS_MEDIA_ROOT`, `ATLAS_EVOLUTION_ROOT` y `ATLAS_CODING_AGENT_ROOT` seleccionan los entornos opcionales de LOR, vídeo, adaptadores Qwen y agentes. Cárgalas en el entorno del proceso; el proyecto no interpreta `.env` automáticamente. El laboratorio ATLAS-LM es un clasificador experimental, no el modelo conversacional Qwen. Sin su checkpoint, las acciones de decisión y entrenamiento no están disponibles; el código del generador por reglas se conserva para preparación independiente.

## Nube y móvil

GitHub almacena y comparte código; no ejecuta este servidor ni ofrece una GPU para Qwen. `cloud/` contiene la interfaz Sites/Vinext y la cola D1, con inicio de sesión y conversaciones separadas por usuario. El proceso `continuous/atlas-cloud-bridge.mjs` consulta esa cola mediante HTTPS y solicita sesiones compartidas al Qwen del PC, sin enviar documentos ni memoria privada. Un navegador móvil no necesita la IP del ordenador; usa la URL publicada del Site. No se abre el puerto administrativo `8788` a Internet.

El PC, su modelo y el puente deben permanecer encendidos para responder. Configura `ATLAS_BRIDGE_TOKEN` en el alojamiento y guarda el mismo valor únicamente en el archivo local ignorado `continuous/data/cloud-bridge.key`. Su compañero `cloud-bridge.json` declara el origen HTTPS del Site. `Start-Cloud-Bridge.ps1` y el supervisor inician el puente solo cuando existen esos archivos. No copies claves de la instalación original. Consulta `cloud/README.md` para compilación, migraciones y límites.

## Casa y herramientas creativas

La casa renderiza geometría 3D real con Three.js, controles táctiles, colisiones y calidad adaptable. Sus diez salas reúnen las funciones creativas, Mente, Ion/Cuerpo, Refutación y LOR-ΩΣ; el chat completo sigue en `/chat/` y la interfaz histórica en `/origen/`. Los robots muestran estados y contadores del coordinador sin convertir movimiento en evidencia de aprendizaje. La casa y el secuenciador musical funcionan en el navegador sin inferencia del PC. El estudio dispone de cuatro pistas, piano sintetizado, mezcla, proyectos JSON y exportación WAV; no utiliza un modelo generativo musical.

Para crear mundos y juegos desde el chat, el puente pide un plan JSON a Qwen, ejecuta comprobaciones de geometría, solicita una revisión y guarda un proyecto procedural en el taller. Arquitecto y revisor son dos pasadas del mismo modelo, sin presentarlas como agentes externos independientes. El taller permite recorrer y exportar los prototipos; la revisión no acredita calidad AAA.

El cine graba MP4 o WebM del lienzo 3D según el navegador. La vía neuronal utiliza Wan2.1 T2V 1.3B mediante ComfyUI local y requiere instalar aparte su entorno y pesos. OpenField es un proyecto distinto: sus motores nativos no se consideran disponibles solo por instalar su interfaz. La reserva GPU descarga Qwen durante el trabajo de vídeo y lo restaura al liberar ComfyUI. Consulta [el contrato del entorno multimedia](docs/MEDIA_RUNTIME.md).

## Autonomía y colaboradores gratuitos

La prioridad es mejorar el funcionamiento antes que ampliar gráficos. El coordinador selecciona Aider, smolagents o el constructor nativo mediante resultados de contratos y exploración acotada; los errores se conservan y permiten volver a otro constructor. Todos utilizan el mismo Qwen local, sin requerir OpenRouter ni otro proveedor de pago. No son modelos independientes ni reciben las credenciales o conectores del asistente que mantuvo el proyecto.

Los adaptadores de agentes comprueban AST; todas las funciones se validan en QuickJS con contratos definidos fuera del generador. Solo las funciones canónicas aprobadas se ofrecen al chat compartido. StrategyPolicy permite modificar una regla del núcleo, evaluar el cambio y recuperar una versión anterior; no habilita edición arbitraria del servidor. LOR-ΩΣ conserva objetos, ambiente, estados, relaciones, transformaciones, invariantes, restricciones, escala, medida, predicciones, falsadores y cadena semiótica. Ver [núcleo y lenguaje](continuous/COGNITIVE_CORE.md), [Aider](continuous/LOCAL_CODING_AGENT.md) y [smolagents](continuous/SMOL_CODING_AGENT.md).

La vía LoRA de Qwen9B está separada: reejecuta contratos de herramientas antes de construir datos formales, exige evidencia nueva y limita los ensayos a un mínimo de seis horas con prioridad para el chat. La instalación de origen completó ocho pasos y exportó un adaptador, pero su confirmación quedó en 4/8 → 4/8: no se activó. Los pesos y los datos de ejecución no se incluyen aquí. Leer documentación o repetir la misma prueba no cuenta como entrenar ni mejorar. Ver [laboratorio de pesos](continuous/QWEN_WEIGHT_EVOLUTION.md).

La inferencia usa el hardware que aloje llama.cpp. Los prototipos no acreditan calidad AAA ni una evaluación general frente a otros asistentes. La copia empieza sin memoria, claves, pesos ni versiones privadas activas del equipo de origen.

## Distribución y dependencias

Las dependencias npm se fijan a las versiones usadas en el proyecto. Three.js y QuickJS conservan sus propias licencias. Los módulos fuente de Three.js reutilizados por la casa desde ERAS incluyen su aviso MIT; la procedencia se documenta en `cloud/lib/house/ERAS_PROVENANCE.md`. Los pesos de terceros tienen condiciones independientes. No se asigna aquí una licencia nueva a código importado cuya titularidad deba revisar el propietario. El manifiesto `docs/source-export-manifest.json` registra los archivos copiados, adaptaciones y exclusiones; no es una auditoría jurídica.
