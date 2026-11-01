# Evolución de pesos de Qwen: laboratorio separado

Este laboratorio prepara **adaptadores LoRA del mismo Qwen3.5-9B**. No sustituye el modelo de conversación por el clasificador ATLAS-LM ni por un modelo pequeño. El GGUF activo se conserva; estos programas no escriben su archivo ni añaden un adaptador al lanzador del chat.

## Estado comprobado

- Entorno independiente en `${ATLAS_EVOLUTION_ROOT}/venv`: Torch 2.14.0+cu126 y Transformers 5.22.1 reutilizados en lectura; PEFT 0.21.2, Accelerate 1.15.0 y BitsAndBytes 0.50.2 instalados en el entorno nuevo. Los entornos anteriores no se actualizaron.
- Snapshot original completo verificado: nueve archivos, cuatro shards Safetensors y 19.319.226.111 bytes totales. El 1 de noviembre de 2026 se completó también el primer entrenamiento experimental real bajo la reserva del coordinador. El perfil NF4 acotado ya tiene una medición; la receta BF16 de 9B continúa fuera de presupuesto.
- Se ha ejecutado un backward y guardado PEFT con una arquitectura Qwen3.5 híbrida diminuta de pesos aleatorios, todos sus parámetros en CPU. No es el checkpoint Qwen9B ni una mejora del chat. Torch llegó a inicializar su runtime CUDA durante esta prueba, pero los parámetros y las operaciones del modelo de prueba permanecieron en CPU.
- El convertidor oficial de llama.cpp, commit `bc428e407a52bd3e21b5985cabeef57cdff9bc4a`, convirtió primero los ocho tensores LoRA MLP de la prueba diminuta a un GGUF QWEN35. El adaptador 9B real se conserva por separado; una conversión no equivale a evaluarlo en inferencia nativa.
- Se preparó un corpus formal separado de entrenamiento, confirmación y regresión. No se importaron chats, datos del disco de juegos ni textos de terceros para entrenar.
- `qwen-evolution-download.py` descargó el snapshot público original en ATLAS_EVOLUTION_ROOT y comprobó SHA-256/Git antes de registrar sus archivos como verificados. Su estado es `verified`, nueve de nueve. Descargar no cuenta como entrenar.

## Primer candidato 9B real: cambios de pesos, sin mejora demostrada

El candidato `qw-d328a48fd2244da8bf46701c6aa08830` completó ocho pasos de optimización sobre **4.194.304 parámetros LoRA** del Qwen3.5-9B original. La ejecución tardó 233,86 segundos y el pico de memoria **asignada por Torch** fue de **8.251.798.528 bytes**. Esta medición no incluye necesariamente toda la memoria reservada por el controlador, el escritorio u otros procesos.

La huella del conjunto de tensores entrenables cambió realmente:

- Antes: `5ad4096556ac84ea9c5e7ba76e4d9ddae2e7feb145b8f7f1767ab3ad9787ae0c`.
- Después: `d925b5f8522933ce6363abeb8141a6e41166c2aba7eb9d5f4bddb441abac1417`.

Las ocho pérdidas fueron finitas. Sin embargo, la confirmación permaneció **4/8 → 4/8** y las regresiones **1/2 → 1/2**. Por tanto, la puerta registró `improvedOnSyntheticHoldout:false`, `canActivate:false` y `active:false`: el adaptador cambió, pero no demostró una mejora y **no sustituyó al modelo del chat**. Qwen volvió a responder tras la liberación del proceso de entrenamiento.

La conversión CPU del adaptador real también terminó: `adapter.gguf`, formato GGUF v3, **128 tensores** y **8.397.856 bytes**. SHA-256: `1399b32d7555627c84ac7d2044ec45ef1beb6494aa1e4aa5b1a7f8ece0ccab5c`. El archivo está en `jobs/qw-d328a48fd2244da8bf46701c6aa08830` del laboratorio de X:, junto a `result.json`, `native-export.json` y `conversion-proof.json`. La cabecera, el tamaño y la huella se comprobaron por una lectura independiente del archivo. **No se activó ni se evaluó todavía en el servidor nativo**; convertirlo correctamente no elimina la ausencia de mejora observada.

Esto verifica que el equipo puede producir un adaptador acotado del mismo 9B; no demuestra que cualquier duración, secuencia o configuración quepa, ni que Atlas haya mejorado su capacidad general. Las siguientes generaciones deben partir de errores y datos verificados nuevos. Repetir el mismo corpus solo para incrementar un contador no cuenta como aprendizaje.

## Memoria y alcance de la receta

La guía específica de [Unsloth para Qwen3.5](https://unsloth.ai/docs/models/qwen3.5/fine-tune) documenta 22 GB de VRAM para LoRA BF16 de 9B y desaconseja QLoRA de esta familia por sus diferencias de cuantización. La RTX 3060 de este equipo tiene 12 GB. Por tanto, no se presenta la receta BF16 como disponible ni se promete que NF4 quepa sin medirlo.

El candidato experimental usa NF4 de BitsAndBytes, base BF16 congelada para los parámetros no cuantizados y LoRA únicamente en `up_proj`/`down_proj` de los MLP de texto. Usa rango 4, secuencias de 128 tokens, lote 1, ocho pasos y tasa `1e-5`. Se conserva BF16 en los grandes embeddings, la cabeza del modelo y los pequeños gates `in_proj_a`/`in_proj_b` de DeltaNet: la preparación genérica k-bit puede convertir los grandes parámetros a FP32 y aumentar mucho la memoria. La prueba acotada produjo pérdidas finitas; todavía no acredita estabilidad a largo plazo ni preservación general de las capacidades.

[Transformers documenta](https://huggingface.co/docs/transformers/model_doc/qwen3_5) que la arquitectura alterna DeltaNet y atención, y que sin los kernels opcionales usa operaciones PyTorch más lentas y con mayor consumo de memoria. No se han instalado kernels Triton no comprobados ni sustituido Torch. [BitsAndBytes publica](https://huggingface.co/docs/bitsandbytes/installation) soporte Windows CUDA para esta generación de GPU; eso no constituye una prueba de rendimiento del modelo completo.

## Modelo original fijado

Modelo: `Qwen/Qwen3.5-9B`, revisión `c202236235762e1c871ad0ccb60c8ee5ba337b9a`, licencia Apache-2.0. Su arquitectura es `Qwen3_5ForConditionalGeneration`. Los pesos Safetensors ocupan 19.306.216.416 bytes; con los archivos de texto necesarios se descargan 19.319.226.111 bytes.

| Shard | SHA-256 oficial |
| --- | --- |
| 1/4 | `db6f444b43d318c92f360a13a25561a6a65b10c0631b8ed305a426dbaa6c380e` |
| 2/4 | `31c7d7e2dd5d207840b31cc59083c8f4c4718959149e0358c0364052bb9a0330` |
| 3/4 | `7ec36ba3a4176a44c3c0876ad80c56a2f70c84bf008d82e9501df642f17dadec` |
| 4/4 | `b62b0c4cd7e44edee103ee8f4fe225f246d5e768e07bfd5f25b63a8aa1fdd0c6` |

El [config oficial](https://huggingface.co/Qwen/Qwen3.5-9B/blob/c202236235762e1c871ad0ccb60c8ee5ba337b9a/config.json) y el índice se conservan como procedencia. `trust_remote_code=False`, `use_safetensors=True` y `local_files_only=True` impiden que el entrenador descargue o ejecute código arbitrario durante la reserva de GPU. El archivo entrenable es diferente del GGUF cuantizado que sirve el chat.

## Integración con el coordinador único

`createQwenEvolution()` de `qwen-evolution.mjs` expone:

1. `status()`: estado, descarga, candidatos preparados/entrenados y límites. No arranca procesos de entrenamiento ni divulga rutas del PC.
2. `preflight()`: ejecuta una comprobación CPU y registra dependencias/modelo disponibles. No carga Qwen ni reserva CUDA.
3. `prepareCandidate({trainCount,holdoutCount})`: genera únicamente casos formales propios y guarda corpus, identidad y receta inmutable. Nunca recibe comandos, URLs, checkpoints o texto de entrenamiento arbitrario.
4. `trainCandidate(id,{signal,onProgress})`: ejecuta el perfil revisado exclusivamente con una reserva del coordinador.
5. `exportCandidate(id,{signal,onProgress})`: convierte un adaptador ya entrenado mediante el convertidor fijado, en CPU. El resultado conserva `nativeInferenceValidated:false` y no activa el archivo.
6. `prepareFromVerifiedTools(records)`: construye un corpus nuevo exclusivamente de herramientas de programación autónoma cuyo contrato canónico de ocho casos vuelve a pasar en QuickJS. Exige origen autónomo, contrato externo conocido, código correcto y coincidencia con los casos del currículo. No basta con que el registro diga `passed:true`.

`probePrepared` permite el primer ensayo experimental cuando dependencias y snapshot están preparados. `ready` permanece falso hasta medir un entrenamiento real. No se debe exigir `ready` para ese primer ensayo, porque esa bandera es precisamente un resultado que todavía no existe.

La preparación desde herramientas limita cada entrada/salida a JSON corto y mide todos los ejemplos mediante el tokenizer original, usando el codificador de entrenamiento ya fijado. Omite los que exceden 128 tokens. Coloca dos muestras nuevas por herramienta al principio del entrenamiento, conserva el resto como confirmación y mantiene las muestras previas de aritmética/LOR y las dos regresiones. Así los ocho pasos iniciales incluyen datos nuevos de las herramientas, en vez de añadirlos tras ejemplos que el perfil corto nunca alcanzaría.

La prueba CPU con las dos herramientas reales de deduplicación y estadísticas reejecutó dieciséis contratos. Preparó 36 muestras de entrenamiento, veinte de confirmación y dos regresiones; las cuatro primeras muestras de entrenamiento corresponden a esas herramientas. Esta preparación no ejecutó otro entrenamiento GPU. La procedencia registra herramienta, tarea de currículo, SHA del código, identidad del contrato y huella de los resultados reejecutados.

`learningDataFingerprint` identifica el contenido de las parejas pregunta–respuesta sin depender de UUID, fechas ni comentarios del código. El supervisor autónomo debe conservar las huellas ya ensayadas y omitir datos idénticos; una implementación distinta de la misma herramienta no autoriza repetir el mismo corpus como si fuera evidencia nueva. El laboratorio admite hasta cuatro herramientas por propuesta y nunca toma historiales privados o páginas de Internet como objetivos de entrenamiento.

La reserva debe existir en `data/gpu-lease.json` con `role:'training'`, `ownerPid` del servicio Node, `nonce` y `expiresAt` futuro. El coordinador debe descargar Qwen de memoria, renovar esa reserva, impedir chat/vídeo/otros entrenamientos GPU y restaurar Qwen al terminar. Python comprueba el propietario antes de cargar el modelo y antes de cada paso. El ejecutor detiene solo el árbol de Python que creó y espera su cierre antes de permitir la restauración. No inicia un servidor adicional ni administra por su cuenta el supervisor.

Los eventos son JSON por línea: `loading`, `baseline_measured`, `training_candidate` y resultado final. El tiempo máximo del proceso es treinta minutos; una cancelación o memoria insuficiente conserva la versión activa y registra el error. La receta no tiene una operación de publicación automática del adaptador.

## Aplicar, refutar y conservar evidencia

El corpus inicial tiene 32 muestras de entrenamiento, ocho de confirmación con entradas y formulaciones distintas y dos regresiones de una familia no entrenada. Sus etiquetas se calculan externamente: productos de enteros y campos originales de LOR-ΩΣ. `E` significa **escala**. No se utiliza la opinión de Qwen como etiqueta de verdad.

No se truncan silenciosamente las muestras: si una supera 128 tokens, el candidato falla antes del entrenamiento. Las etiquetas enmascaran exactamente el prefijo que usa la generación para evitar entrenar sobre un bloque de pensamiento o perder parte de la respuesta. Cada candidato fija SHA-256 del corpus y del entrenador; un cambio de implementación exige preparar otro candidato sin reescribir el anterior. Con el tokenizer original ya se comprobaron las 32 muestras: 59–77 tokens, con respuestas correctamente enmascaradas.

Se miden las mismas pruebas antes y después del adaptador, sin gradiente sobre confirmación/regresión. El resultado conserva respuestas, aciertos, pérdida, pasos, tiempo y pico de memoria asignada. Solo se registra una mejora sintética si aumenta el número de aciertos de confirmación sin reducir las regresiones. Una menor pérdida de entrenamiento, un archivo de adaptador nuevo o una animación no acreditan mejora general.

Incluso si supera esa puerta, `canActivate` permanece falso hasta convertir el adaptador real y comparar su inferencia GGUF con el modelo activo. Esta evaluación nativa todavía no está implementada aquí. Tampoco se afirma una prueba ciega general: las familias iniciales son pequeñas y sintéticas; deben ampliarse con tareas independientes antes de generalizar resultados.

En el marco cuerpo–mente–Dios: el cuerpo/Ion impone recursos y ejecuta; la mente propone adaptaciones y conserva memoria; la constelación aporta documentación y controles contrastables; la refutación decide si la evidencia permite conservar un candidato. LOR-ΩΣ registra objetos, ambiente, estados, relaciones, transformaciones, invariantes, restricciones, escala, medida, predicciones, falsadores y semiosis. Esta organización por sí sola no cambia pesos.

## Comprobaciones

`node --test qwen-evolution.test.mjs` y `python -m unittest test_qwen_evolution.py` comprueban separación de datos, etiquetas, límites, identidad, reservas, máscaras, rechazo de regresiones e inmutabilidad de resultados. La prueba de arquitectura CPU se ejecuta por separado con `qwen-evolution-cpu-smoke.py`; no se presenta como entrenamiento de Qwen9B.

Los pesos, paquetes, cachés, parciales y adaptadores permanecen en ATLAS_EVOLUTION_ROOT. El código fuente puede exportarse; `models`, `cache`, `jobs`, los informes privados de ejecución y los checkpoints no forman parte del repositorio de código.
