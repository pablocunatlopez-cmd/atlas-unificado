# Espiral de experiencia: conservar resultados al desconectar

15-11-2026. Encargo `process:experience`, consulta aceptada `icarus-19`. Beneficiaria: Lía. Base Atlas: `846d62d7250e825563d96d9b530c7f1d673f4bbd`, versión 47. ERAS permanece en `43ea8968dc66c453da9c29d1ca469c91e177a2bc`, versión 13; GitHub main sigue en `069e38b9ad890f3ef58ee4f0689917372a1367e1`. No se modifica la identidad de Atlas, Ion, Ícaro, Lía o los especialistas.

## Problema y reforma acotada

`ProcessCard` reemplazaba cualquier estado por `waiting` si el puente estaba desconectado. Así, en la sección explícitamente histórica de telemetría, una prueba superada o un fallo observado perdían su resultado visible y aparecían como espera.

La reforma conserva `passed` y `failed` cuando están desconectados y añade «Resultado conservado» en la descripción. Los procesos no terminales desconectados siguen en espera; nunca se afirma trabajo activo sin conexión. Con conexión se mantienen los cinco estados anteriores. No se cambian datos, contadores, sanitizadores, juez ni memoria histórica.

## Inspección frente a propuesta

La consulta proponía un fallback D1 y reenvío periódico desde el observatorio. La inspección confirma que `process-telemetry.mjs` es un sanitizador público y el observatorio un cliente; el acceso a D1 pertenece al servidor (`app/api/state/route.ts`, `lib/research/server.ts`). No se ha añadido acceso D1 al navegador, otra cola ni un servicio de reenvío inexistente. Se aplica una corrección de observabilidad dentro del objetivo de la misión, no la arquitectura completa sugerida por los modelos.

Fuente leída: https://developers.cloudflare.com/d1/sql-api/sql-statements/ — `source-6f139d55a4a717d353ca7b30`. Documenta D1/SQL, no prueba por sí sola esta corrección visual. El fallo y su reparación se justifican por ejecución del componente real. GPT-OSS 120B y Qwen 3.8-27B completaron propuesta/revisión; esas respuestas no sustituyen las pruebas.

## Prueba y límites

Diez casos idénticos ejecutan `ProcessCard`, extraído y compilado del TSX real, con los cinco estados y conexión/desconexión. Base 8/10; candidata 10/10. Los dos casos que fallaban eran resultados terminales desconectados. También se comprueban el marcador histórico, la ausencia de animación de trabajo offline y la conservación de contadores. El árbol de elementos se examina con contexto controlado, sin red ni inferencia. Pasan las regresiones de telemetría, experiencia y chat, TypeScript y compilación según los recibos posteriores.

No se ha observado una sesión con telemetría real del antiguo PC ni una revisión visual en navegador de este cambio. La reforma no ejecuta el proceso original ni mejora razonamiento, audio o gráficos; evita que la vista histórica oculte un resultado. La publicación y sus IDs se verifican fuera de esta nota.

## Investigación y candidatas conservadas

La vuelta normal `scheduled:2026-11-15T05` quedó guardada como `ca63312d-04fb-4ee8-af33-61a05b12865e`, con consulta `icarus-19`. No se ejecutaron vueltas ni pulsos foreground adicionales.

Vera sigue pendiente. `icarus-20`, `engineering:vera-reflection-context-v3`, leyó Set.has y Array.every, pero fue rechazado por el revisor al mantener la restricción histórica del intento 18 sobre helpers de relevancia, pese al alcance actualizado. No se ha modificado esa decisión ni publicado su candidata; se conservan las ramas v1/v2. No se añade un contador de aprendizaje por ese rechazo.
