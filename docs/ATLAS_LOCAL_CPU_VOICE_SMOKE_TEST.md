# Atlas: prueba local CPU de voz e inferencia

Esta guía no instala modelos, no ejecuta nada por sí sola y no consume créditos de API.

## Requisitos

- Node.js 22 o posterior para los módulos de Atlas.
- `llama-server` de llama.cpp instalado localmente y un modelo GGUF autorizado.
- `whisper-cli` de whisper.cpp y un modelo local autorizado.
- Un archivo de audio WAV compatible con whisper.cpp.
- Espacio libre en RAM suficiente para cada proceso.

## Comprobación de llama.cpp

1. Inicia `llama-server` con un modelo GGUF pequeño, CPU y contexto reducido, por ejemplo:
   `llama-server -m /ruta/absoluta/modelo.gguf -c 1024 -ngl 0 --host 127.0.0.1 --port 8080`
2. Comprueba desde el propio ordenador:
   `curl -fsS http://127.0.0.1:8080/health`
3. Realiza una petición local de prueba al endpoint `/v1/chat/completions` con el cliente de Atlas.
4. Registra tiempo de respuesta, tokens y memoria del proceso **llama-server**, además del RSS de Node. Son procesos distintos.

## Comprobación de whisper.cpp

1. Ejecuta sobre un WAV de prueba local:
   `whisper-cli -m /ruta/absoluta/whisper-model.bin -f /ruta/absoluta/audio.wav -nt`
2. Verifica manualmente la transcripción. No se debe asumir que el texto es correcto solo porque el proceso termine con código cero.
3. Usa `atlas-local-voice-session.mjs` para revisar el texto antes de confirmar la consulta.

## Criterios de aceptación

- Sin conexiones a proveedores externos ni descarga automática.
- El modelo no recibe transcripciones sin confirmación.
- Un fallo de transcripción no desencadena inferencia.
- Se registran los fallos y los límites de tiempo sin atribuir falsamente éxito.
- Se mide RAM del proceso de inferencia por separado. `process.memoryUsage().rss` de Node **no mide** la RAM de llama-server.
- Se registra el hardware real utilizado. Ninguna prueba simulada equivale a una prueba real de audio o rendimiento.

## Estado

Pendiente de ejecución en el ordenador del usuario. Los módulos actuales permiten preparar y probar la integración, pero no demuestran todavía la compatibilidad del hardware ni la calidad de reconocimiento.
