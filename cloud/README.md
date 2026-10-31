# Atlas · interfaz de nube

Esta aplicación Sites/Vinext sirve el chat HTTPS compartible y mantiene una cola D1 con conversaciones separadas por usuario. La ruta `/origen` conserva la interfaz, los documentos estáticos y los experimentos procedurales de la versión original de Sites. El chat nuevo no es aquel pequeño modelo extractivo: envía trabajos al puente saliente del ordenador, que usa Qwen local.

## Arquitectura

El navegador inicia sesión con ChatGPT y crea un trabajo propio en `/api/cloud`. Un proceso local consulta la cola a través de HTTPS, ejecuta una sesión compartida de Qwen sin acceso a archivos privados ni comandos administrativos del PC y devuelve únicamente la respuesta. No se abren puertos del ordenador. El PC y su servidor Qwen deben permanecer encendidos para responder. GitHub y Sites no proporcionan una GPU Qwen por este despliegue.

## Configuración

Instala las dependencias con el gestor fijado en `packageManager` y conserva el lockfile. El proyecto usa Sites con Cloudflare Workers y D1; `.openai/hosting.json` mantiene la identidad del proyecto original. Un fork debe registrarse como otro Site antes de publicar. Usa el flujo del plugin Sites para aplicar las migraciones y desplegar. No copies `.sites-runtime`, `.env`, bases de datos locales, registros ni credenciales.

El runtime necesita `ATLAS_BRIDGE_TOKEN` como secreto del alojamiento, nunca en el código cliente. El mismo secreto del puente debe existir solo en el archivo ignorado `continuous/data/cloud-bridge.key` del ordenador. Su archivo `cloud-bridge.json` contiene `{ "siteUrl": "https://tu-site.example" }`. El lanzador local `Start-Cloud-Bridge.ps1` solo arranca cuando ambos archivos existen.

## Verificar

Ejecuta `node node_modules/typescript/bin/tsc --noEmit --incremental false` y las pruebas de `tests/` con el comando de tipos compatible con tu Node. El build se realiza con `npm run build` dentro de esta carpeta o con el helper de compilación de Sites. No se instala un servidor GPU en la nube automáticamente.

## Datos de semilla y licencias

`data/` contiene únicamente siete semillas estáticas de la versión original ya publicada, necesarias para compilar `/origen`; no son conversaciones D1 ni memoria del PC. Se quitó el enlace identificador de la conversación privada de la semilla de continuidad. Se conservan CSS y avisos de licencia del starter. Las migraciones y sus metadatos se mantienen íntegros. La copia de código no concede una licencia nueva a componentes o modelos de terceros.
