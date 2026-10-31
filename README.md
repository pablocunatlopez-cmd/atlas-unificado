# Atlas · código compartible

Asistente general local con chat Qwen, fuentes públicas, biblioteca GitHub, refutación, funciones JavaScript aisladas y prototipos. Esta distribución conserva el código y sus pruebas; excluye claves, conversaciones, memoria privada, pesos Qwen, checkpoints y datos de entrenamiento privados del equipo de origen. `cloud/` conserva siete semillas estáticas ya publicadas en Sites, incluido el pequeño MLP original necesario para compilar su interfaz histórica.

## Ejecutar localmente

1. Instala Node.js 22.20 o posterior y ejecuta `npm install`, después `npm run setup`.
2. Configura llama.cpp por separado, con un modelo GGUF que tengas derecho a usar, alias `atlas-local`, puerto local `11435` y `--api-key-file continuous/data/chat-local.key`. Los modelos no se descargan ni redistribuyen con este repositorio.
3. Ejecuta `npm start` y abre `http://127.0.0.1:8788/chat/`. El servidor principal permanece limitado al propio ordenador. En Windows, los lanzadores PowerShell pueden iniciar el supervisor si colocas llama.cpp en `llama/` y el GGUF esperado en `models/`; para otros nombres, adapta `continuous/Start-Chat.ps1`.
4. Ejecuta `npm test` para las pruebas locales. Las pruebas Python son independientes y pueden requerir PyTorch.

La instalación arranca con memoria vacía, sin claves externas y sin pesos del laboratorio. `continuous/config.example.json` contiene las fuentes públicas iniciales. La configuración local `continuous/config.json` y `continuous/data/` están ignoradas por Git. No publiques esas carpetas.

Las variables opcionales `ATLAS_LAB_PYTHON` y `ATLAS_GAMES_ROOT` seleccionan el intérprete del laboratorio y una carpeta de juegos autorizada. `ATLAS_GPU_PYTHON` puede fijar la ruta del entrenador experimental al crear por primera vez la configuración; el backend inicial sigue siendo CPU. Cárgalas en el entorno del proceso; el proyecto no interpreta `.env` automáticamente. El laboratorio ATLAS-LM es un clasificador experimental, no el modelo conversacional Qwen. Sin su checkpoint, las acciones de decisión y entrenamiento no están disponibles; el código del generador por reglas se conserva para preparación independiente.

## Nube y móvil

GitHub almacena y comparte código; no ejecuta este servidor ni ofrece una GPU para Qwen. `cloud/` contiene la interfaz Sites/Vinext y la cola D1, con inicio de sesión y conversaciones separadas por usuario. El proceso `continuous/atlas-cloud-bridge.mjs` consulta esa cola mediante HTTPS y solicita sesiones compartidas al Qwen del PC, sin enviar documentos ni memoria privada. Un navegador móvil no necesita la IP del ordenador; usa la URL publicada del Site. No se abre el puerto administrativo `8788` a Internet.

El PC, su modelo y el puente deben permanecer encendidos para responder. Configura `ATLAS_BRIDGE_TOKEN` en el alojamiento y guarda el mismo valor únicamente en el archivo local ignorado `continuous/data/cloud-bridge.key`. Su compañero `cloud-bridge.json` declara el origen HTTPS del Site. `Start-Cloud-Bridge.ps1` y el supervisor inician el puente solo cuando existen esos archivos. No copies claves de la instalación original. Consulta `cloud/README.md` para compilación, migraciones y límites.

La inferencia usa el hardware que aloje llama.cpp. Los reflejos, la lectura de documentación y las extensiones probadas no reentrenan automáticamente Qwen. Los prototipos de ejemplo no acreditan calidad AAA ni capacidad de producción de juegos completos.

## Distribución y dependencias

Las dependencias npm se fijan a las versiones usadas en el proyecto. Three.js y QuickJS conservan sus propias licencias; no se han copiado sus paquetes binarios al árbol fuente. Los pesos de terceros tienen condiciones independientes. No se asigna aquí una licencia nueva a código importado cuya titularidad deba revisar el propietario. Antes de una publicación pública, confirma las autorizaciones de los componentes importados. El manifiesto `docs/source-export-manifest.json` registra los archivos copiados, adaptaciones y exclusiones; no es una auditoría jurídica.
