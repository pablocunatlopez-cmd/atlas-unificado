# Publicación vigente verificada · 1 de noviembre de 2026

Sites público V17, fuente `f89a17425b72ac792be2149b9f6d9ecc6cae419a`, publicado el 1 de noviembre a las 21:05:41 UTC. Dirección principal: https://atlas-personal.pablo-cunatlopez.chatgpt.site/ ; conversación: /chat/ ; actividad: /actividad/ . La inferencia sigue en el PC mediante el puente saliente; cambiar la IP del teléfono no exige acceder a 127.0.0.1.

La casa muestra diez habitantes de cuatro tipos con gestos ligados a procesos recientes y marcas tomadas del contador real de cambios aceptados. Las etiquetas se limitan a 220 px al acercarse; se comprobaron a 390×844. La vista móvil se probó en un navegador del PC; no es una medición de rendimiento de un iPhone.

El chat recibe la identidad y el inventario del programa completo. La petición «Continúa mejorándote» se comprobó en el hilo del usuario: encoló una revisión real. Las descripciones de capacidades se reconstruyen desde el inventario para impedir negaciones genéricas de funciones implementadas. El MCP OpenAI Docs dispone de búsqueda pública anónima; las demás extensiones de Codex no se han transferido por nombre ni se han sustituido por 32 roles.

La guía `DIRECCIONES_ATLAS_2026-11-01.md` se incorpora al planificador y a conversaciones relevantes. El coordinador excluye nuevos lotes con la misma fuente/cobertura tras tres lotes completos sin contradicciones; las funciones del chat siguen disponibles. Esta saturación delimita presupuesto y no demuestra corrección universal. La ampliación a nuevas clases necesita evidencia y ejecutores verificables.

Las publicaciones y verificaciones siguientes se conservan como historia; no sustituyen este estado de entrega.

---
# Atlas desde el móvil y la nube

Dirección publicada: https://atlas-personal.pablo-cunatlopez.chatgpt.site/

La interfaz y los historiales privados por usuario se alojan en Sites/Cloudflare D1. Cada visitante inicia sesión con ChatGPT para conversar. Qwen3.5-9B continúa ejecutándose en la GPU del PC: el ordenador debe permanecer encendido y conectado. GitHub almacena código; no proporciona esta GPU de inferencia.

El trabajador `atlas-cloud-bridge.mjs` realiza conexiones salientes HTTPS. No hay puertos abiertos, cambios de router ni túnel hacia el servidor administrativo. La clave generada se guarda en `data/cloud-bridge.key` y como secreto ATLAS_BRIDGE_TOKEN en el sitio. No debe subirse a GitHub ni copiarse al navegador. `Watch-Atlas.ps1` inicia el puente cuando el servicio y Qwen están disponibles; `data/service.stop` mantiene la orden de apagar Atlas.

Los mensajes de la web usan `sharedSession:true`: no incorporan documentos privados, recuerdos, mandato personal, inventario de juegos o controles del PC. Solo se comparten las funciones públicas canónicas aprobadas y ejecutadas en QuickJS; no se exponen controles privados ni herramientas arbitrarias del ordenador. Los historiales de otras personas se aíslan mediante identidad verificada en el servidor. Las conversaciones antiguas guardadas solo en el navegador del PC no se han copiado a D1.

El código web canónico se recuperó del sitio original en `cloud/`. Conserva sus herramientas anteriores en /origen y añadió cola de mensajes, reservas, cancelación e historial. La versión pública vigente es V12, commit 503ee94aeedd7f8cb1bdb90c6679a19ba5114b29. Su portada es una casa 3D de diez salas; el chat completo sigue en /chat/ y los proyectos en /taller/. El código compartible, sin claves ni datos privados del PC, está en el repositorio privado ya creado https://github.com/pablocunatlopez-cmd/atlas-unificado.

Límites actuales: una inferencia local simultánea, 20 solicitudes por usuario/hora y 30 trabajos pendientes globales. La cola conserva mensajes cuando el PC está desconectado y vuelve a intentarlos cuando el motor se conecta. La web muestra el estado real del puente. La inferencia no se ha migrado a una GPU de nube ni se han contratado servicios de pago.

Las solicitudes creativas añaden trabajos world, game y video. Qwen propone y revisa planes de datos, un validador externo limita la geometría y el compilador guarda proyectos HTML/glTF privados por usuario. La revisión usa el mismo modelo; no constituye una evaluación independiente. El estudio musical sintetiza sonido con WebAudio y exporta WAV en el dispositivo. La casa reutiliza módulos gráficos y controles táctiles de ERAS y graba capturas 3D MP4/WebM en el navegador.

El vídeo neuronal usa Wan 2.1 T2V 1.3B con ComfyUI local y almacenamiento privado R2. El coordinador reserva la GPU, descarga Qwen de memoria, genera el vídeo, libera ComfyUI y restaura Qwen. No ejecuta workflows arbitrarios. OpenField está instalado y compilado, pero sus modelos nativos LTX no se han activado; es una integración distinta de Wan. Los pesos, entornos y vídeos permanecen en X:, fuera del repositorio de código. El usuario sigue necesitando este PC encendido para las tareas neuronales.

La prioridad actual es mejorar la autonomía antes que ampliar la casa 3D. El ciclo local dispone permanentemente de Aider 0.86.2 y del generador nativo, seleccionados por resultados de contratos; ambos utilizan el mismo Qwen y no necesitan OpenRouter ni una activación por turno. La política DSL activa alcanzó 9/9 contratos desde una base de 8/9. Qwen creó el validador estructural LOR-ΩΣ y pasó sus ocho contratos externos. Son mejoras acotadas de código, no una evaluación general del modelo.

El ensayo real de Qwen9B entrenó un LoRA de 4,19 millones de parámetros durante ocho pasos y produjo su exportación GGUF. No mejoró la evaluación (4/8 → 4/8) y no está activo. El proceso autónomo prepara nuevos candidatos únicamente a partir de herramientas verificadas y datos nuevos, con al menos seis horas entre ensayos y prioridad para el chat. No instala extensiones de VS Code ni modifica arbitrariamente el servidor. El detalle y los límites constan en `VERIFICACION_AUTONOMIA_2026-11-01.md`.

La comprobación HTTP real de herramientas públicas ejecutó LOR (`toolUsed:true`) y devolvió `missing:["E"]`, con memoria y fuentes privadas en cero. Una orden `/atlas parar` desde la sesión compartida recibió HTTP 400. Esto verifica el uso de la función pública y la separación de los controles locales.

Verificación: compilación de producción y TypeScript aprobados; seis pruebas de SQLite real sobre migraciones, aislamiento, reservas y límites; tres pruebas del puente saliente; sesión local compartida comprobada contra Qwen y controles del PC rechazados. Estado publicado del motor comprobado mediante /api/cloud/status. La prueba autenticada en el sitio publicado envió «¿Cuánto es 17 por 23?», recibió 391 de Qwen y recuperó ambos mensajes desde el historial después de recargar. El flujo web → D1 → puente HTTPS → GPU → respuesta quedó comprobado.

La versión 11 añade smolagents a la constelación y a la telemetría pública. Aider, smolagents y el constructor nativo usan Qwen local. Los dos primeros ensayos de smolagents fallaron sus contratos y permanecen rechazados; la pantalla muestra resultados reales, no un ranking universal.

Sites es la dirección principal que debe mantenerse vigente. La versión 12 añade /actividad/: revisión, fechas, estado y catálogo público verificado se actualizan cada diez segundos mediante el puente. Los cambios de interfaz se publican mediante Sites; una herramienta canónica nueva llega al catálogo por el heartbeat sin volver a publicar la web. Los ejemplos se preparan en el chat sin enviarse automáticamente. La caché de referencias oficiales de programación se conserva en el PC y sus extractos no se publican en el catálogo.
