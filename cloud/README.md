# Atlas · interfaz de nube

Esta aplicación Sites/Vinext sirve una casa 3D navegable y herramientas creativas junto al chat HTTPS compartible. La cola D1 conserva conversaciones y proyectos separados por usuario; R2 almacena los MP4 neuronales privados. La ruta `/origen` conserva la interfaz, los documentos estáticos y los experimentos procedurales de la versión original de Sites. El chat nuevo en `/chat/` envía trabajos al puente saliente del ordenador, que usa Qwen local.

La casa reutiliza el motor y el joystick de ERAS con módulos Three.js y geometría procedural. Sus seis habitaciones reúnen conversación, música WebAudio/WAV, laboratorio 3D, juegos, cine y constelación. El taller guarda diseños Qwen que superan la validación de esquema y geometría, y permite exportar HTML y glTF. Arquitecto y revisor usan el mismo Qwen; no representan modelos externos conectados. La captura del entorno 3D funciona en el navegador. Wan/ComfyUI genera vídeo neuronal en el PC cuando su instalación separada está preparada.

## Arquitectura

El navegador inicia sesión con ChatGPT y crea un trabajo propio en `/api/cloud`. Un proceso local consulta la cola a través de HTTPS y ejecuta una sesión compartida de Qwen sin acceso a archivos privados ni comandos administrativos del PC. Los trabajos creativos devuelven planes validados o un MP4 generado por el flujo fijo de vídeo, nunca rutas de archivos arbitrarias. Las descargas comprueban identidad, propietario y reserva completada antes de acceder a R2, con rangos de bytes para Safari. No se abren puertos del ordenador. El PC debe permanecer encendido para responder y generar. GitHub y Sites no proporcionan una GPU por este despliegue.

## Configuración

Instala las dependencias con el gestor fijado en `packageManager` y conserva el lockfile. El proyecto usa Sites con Cloudflare Workers, D1 (`DB`) y R2 (`BUCKET`); `.openai/hosting.json` mantiene la identidad del proyecto original. Un fork debe registrarse como otro Site antes de publicar. Usa el flujo del plugin Sites para aplicar las migraciones y desplegar. No copies `.sites-runtime`, `.env`, bases de datos locales, registros ni credenciales.

El runtime necesita `ATLAS_BRIDGE_TOKEN` como secreto del alojamiento, nunca en el código cliente. El mismo secreto del puente debe existir solo en el archivo ignorado `continuous/data/cloud-bridge.key` del ordenador. Su archivo `cloud-bridge.json` contiene `{ "siteUrl": "https://tu-site.example" }`. El lanzador local `Start-Cloud-Bridge.ps1` solo arranca cuando ambos archivos existen.

## Verificar

Ejecuta `node node_modules/typescript/bin/tsc --noEmit --incremental false` y las pruebas de `tests/` con el comando de tipos compatible con tu Node. El build se realiza con `npm run build` dentro de esta carpeta o con el helper de compilación de Sites. No se instala un servidor GPU en la nube automáticamente.

## Datos de semilla y licencias

`data/` contiene únicamente siete semillas estáticas de la versión original ya publicada, necesarias para compilar `/origen`; no son conversaciones D1 ni memoria del PC. Se quitó el enlace identificador de la conversación privada de la semilla de continuidad. Se conservan CSS y avisos de licencia del starter. Las migraciones y sus metadatos se mantienen íntegros. La copia de código no concede una licencia nueva a componentes o modelos de terceros.
