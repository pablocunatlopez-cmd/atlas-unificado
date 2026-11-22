# Atlas Ω — hoja de ruta para cine, universos 3D y música

**Estado: propuesta técnica, no implementación certificada.** GPU objetivo: 12 GB VRAM; funcionamiento CPU degradado; sin créditos OpenAI obligatorios.

## Arquitectura

Lía es la IA conversacional general, comparable en interacción a ChatGPT. La casa permite visitar personajes existentes y hablar con ellos o volver al chat unificado. El mundo sensorial es distinto de Lía: círculo de experiencia accesible y triángulo Atlas/Mundo Mental, Ion/Mundo Físico, Dios/Suceso. El suceso inesperado revisa las hipótesis y conserva historial. La espiral y su tiempo tangente son un modelo filosófico, no una ley física.

Preservar IDs, personalidades, memoria, habitaciones y permisos existentes. Las nuevas asignaciones de capacidad son propuestas hasta que tengan ejecutores reales y pruebas.

## P0: medir antes de prometer

- Inventario de módulos existentes en Sites, ERAS, worker local y modelos.
- Detección real de hardware en el PC autorizado; no asumir GPU activa.
- Presupuesto VRAM y cola con límites, cancelación, reanudación, logs y rollback.
- No ejecutar código arbitrario ni descargar pesos sin validación y autorización.

## P1: casa de Lía

- Chat general con historial autorizado, procedencia, herramientas y límites.
- Entrar en una sala, hablar directamente con su personaje, pedir colaboración y volver a Lía.
- Actividad visual respaldada por trabajos reales; nunca simular ejecución ni conciencia.
- Conservar el elenco histórico y marcar nuevas propuestas como tales.

## P2: universos 3D

- Blender y Geometry Nodes para activos y generación procedural; Godot para simulación y exploración; glTF para intercambio; Three.js/ERAS para la interfaz web.
- Petición -> especificación JSON validada -> escena -> materiales PBR -> LOD/instancing -> colisiones -> exportación editable.
- Streaming por sectores y perfiles de calidad para móvil, CPU y GPU.
- Da Vinci diseña, Talo visualiza, Teo anima, Sigma compone escenas, Vera verifica.

## P3: cine

- Director crea guion, storyboard, desglose, planos, cámaras y continuidad.
- Render determinista 3D como base controlable; FFmpeg para edición y exportación.
- Vídeo generativo local opcional tras medir pesos, licencias, VRAM, duración y tiempos reales.
- En 12 GB: clips cortos, offload, lotes secuenciales, interpolación y posproducción; nunca cargar simultáneamente modelos grandes.
- Evaluación ciega contra Higgsfield: coherencia, movimiento, artefactos, control, tiempo y memoria. No declarar superioridad sin resultados.

## P4: música

- Noa y Ritmo crean estructura, armonía, melodía, MIDI, pistas, arreglos y mezcla.
- Síntesis y muestras con licencia, exportación MIDI/WAV/stems y compatibilidad con Ableton.
- Modelos de audio opcionales y medidos en hardware real; generación y masterización separadas.
- Evaluación ciega contra Suno: composición, producción, coherencia, originalidad y editabilidad.
- Sin clonación de voces sin consentimiento.

## P5: evaluación y despliegue

- Versionar modelos, prompts, semillas, licencias, activos y hardware; medir VRAM pico, latencia, fallos y calidad.
- Los benchmarks sintéticos no prueban calidad competitiva.
- GitHub Actions prueba código, no render CUDA ni despliegue en Sites.
- Publicar en Sites solo desde el proyecto original con comprobación de datos, migración y rollback.

## Primera entrega verificable

1. Lía conversa y permite cambiar de personaje sin perder contexto autorizado.
2. Una escena pequeña se crea, guarda, reabre y edita.
3. Un storyboard produce vídeo determinista.
4. Una composición produce MIDI y WAV por pistas.
5. Las tareas que exceden VRAM se rechazan o degradan explícitamente.
6. El sistema distingue disponible, experimental y no ejecutado.
