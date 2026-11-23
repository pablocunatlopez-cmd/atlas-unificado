# Entorno multimedia local

La distribución contiene los adaptadores y sus pruebas; no incluye entornos Python, paquetes instalados, pesos de modelos ni resultados personales. El chat y la casa se pueden utilizar sin instalar el proveedor de vídeo neuronal.

## Componentes separados

| Componente | Procedencia | Uso en Atlas |
| --- | --- | --- |
| Casa ERAS y Three.js | Fuente ERAS del propietario; licencia MIT de Three.js incluida | Render 3D en navegador y grabación del lienzo |
| OpenField | https://github.com/wexloops/openfield, revisión `5bbd1c7e31bb03289f558e71e9412747c1c5b346` | Fuente e interfaz preparadas en la instalación original; generación nativa no habilitada |
| ComfyUI | https://github.com/Comfy-Org/ComfyUI | Ejecución local de un workflow Wan fijo |
| Wan2.1 T2V 1.3B | https://github.com/Wan-Video/Wan2.1, Apache-2.0 | Vídeo neuronal local, con GPU exclusiva |

Wan no es un motor nativo de OpenField. Instalar OpenField no conecta por sí solo un generador de vídeo. Sus motores LTX necesitan otros pesos y sus propias condiciones de acceso; no se instalan aquí mediante claves o aceptación automática.

## Preparación del proveedor Wan

En esta distribución, `ATLAS_MEDIA_ROOT` selecciona el directorio del entorno multimedia. Si se omite, el adaptador busca `continuous/data/media`, ignorado por Git. Usa un disco con espacio suficiente: los tres pesos suman 9 828 025 775 bytes, además del entorno Python, cachés y resultados. La instalación es separada y debe verificarse en el hardware de destino.

El adaptador espera `ComfyUI/main.py`, el intérprete `venv/Scripts/python.exe`, los modelos de la receta oficial de [ComfyUI para Wan](https://comfyanonymous.github.io/ComfyUI_examples/wan/) y los codificadores VP9/H.264. El puerto ComfyUI se limita a `127.0.0.1:8188`. Python 3.11, Torch CUDA compatible, las dependencias Comfy y `imageio-ffmpeg` se instalan aparte; no se actualizan entornos preexistentes automáticamente.

| Subcarpeta bajo `ComfyUI/models` | Archivo | SHA-256 |
| --- | --- | --- |
| `diffusion_models` | `wan2.1_t2v_1.3B_fp16.safetensors` | `be531024cd9018cb5b48c40cfbb6a6191645b1c792eb8bf4f8c1c6e10f924dc5` |
| `text_encoders` | `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | `c3355d30191f1f066b26d93fba017ae9809dce6c627dda5f6a66eaa651204f68` |
| `vae` | `wan_2.1_vae.safetensors` | `2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b` |

`videoStatus()` exige los ficheros, sus tamaños y evidencia de verificación SHA en `download-status.json`, además de una comprobación de entorno en `runtime-ready.json`. Estos registros se producen durante la preparación y no se distribuyen como una disponibilidad falsa. `lastRender` solo se muestra si existe un MP4 conservado y su prueba local. Las pruebas unitarias no sustituyen un render real ni una evaluación de calidad.

## Reserva de GPU

El coordinador impide solapar Qwen y el modelo de vídeo. Publica una reserva renovable que el supervisor valida, descarga solo el proceso llama.cpp reconocido y arranca su propio ComfyUI. Al terminar o cancelar, libera su proceso de vídeo y restaura Qwen. El arranque del modelo usa un mutex para evitar duplicados; la petición de parada del usuario mantiene la prioridad.

El flujo acepta únicamente texto y parámetros acotados: no instala nodos personalizados, no ejecuta código del prompt y no acepta workflows ni rutas de salida arbitrarias. La prueba inicial usa 17 fotogramas, 480 × 272, cinco pasos y 8 fps. El límite es treinta minutos y los resultados se codifican como MP4 H.264. La GPU y la RAM del equipo determinan el rendimiento; este mecanismo no acredita calidad cinematográfica.

## Prueba de funcionamiento

El 31 de octubre de 2026, la instalación original generó y decodificó un MP4 H.264 de 17 fotogramas, 480 × 272, 8 fps y 2,125 segundos, con 27 466 bytes. La generación y codificación tardaron 224,9 segundos en una RTX 3060 de 12 GB, aparte del arranque y la recuperación del chat. El máximo de VRAM observado en el muestreo fue de 10 522 MB. ComfyUI quedó liberado y Qwen recuperó su respuesta de salud. Esta prueba demuestra el flujo local, sin acreditar calidad de producción ni el mismo rendimiento en otros equipos; el vídeo de prueba no se incluye en el repositorio.
