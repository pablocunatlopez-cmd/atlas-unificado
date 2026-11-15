# Atlas · ciclo de cambios y evidencia

`planAtlasCodingCycle` sigue siendo un planificador síncrono: no cambia archivos,
no ejecuta pruebas y no autentica los indicadores del gate anterior.

`reviewAtlasCodingCycle` construye ese plan, rechaza objetivos sin resolver y
envía el identificador de propuesta, el SHA, las acciones derivadas del plan y
la evidencia a `evaluateAtlasVerifiedChange`. El verificador asíncrono debe ser
proporcionado por el host confiable, nunca por el autor de la propuesta.
Un resultado `readyForHumanReview` solo indica que ese verificador aceptó los
checks requeridos y, para acciones sensibles, la aprobación. El resultado
siempre contiene `executionAuthorized: false`; no publica ni ejecuta cambios.
Si el verificador falla, se propaga el error en vez de declarar éxito.

El identificador de propuesta es una cadena validada, no necesariamente un
UUID. Este ciclo no garantiza por sí solo unicidad, consumo único ni que el
contenido del parche corresponda al commit. Tampoco valida firmas, identidad,
caducidad o procedencia de CI: todas esas garantías requieren un host confiable
y almacenamiento durable. Sin ellos no es una autoridad de producción.
