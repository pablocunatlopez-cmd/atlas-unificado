# Candidata: acumulación compensada en estadísticas

22-11-2026. Base Atlas v62, 5b644675549c831c5e80d490a6e2661e9d196bfc. Misión resident:body-console. Sin publicar; no hay recibo de aplicación.

Defecto ejecutado: stats([1e16,1,-1e16]) devuelve total=0 y mean=0 en la base, aunque la suma exacta de esos números representables es 1 y la media 1/3. Una prueba nueva falló antes de modificar el algoritmo.

La candidata usa acumulación compensada de Neumaier, autocontenida en statistics para conservar su exportación. Mantiene el límite de 128 valores finitos, formato de salida, mediana, ausencia de mutación de entrada y rechazo de desbordamiento. Revisión de biblioteca atlas-program-tools-2; no se cuentan las otras cuatro funciones como mejoras nuevas. La misma prueba pasa después con total=1 y mean=1/3.

Fuentes leídas: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON y https://docs.python.org/3/library/math.html#math.fsum . Documentan límites de coma flotante y sumas de mayor precisión; no verifican nuestro código privado ni acreditan equivalencia de este algoritmo con math.fsum. Las referencias quedaron guardadas en icarus-83 como source-7a488979952573a89ef9f8c9 y source-73b8f8352bd632f41e70387b.

Pruebas ejecutadas: 15 casos de biblioteca/herramientas/cancelación pasan; incluyen las 24 permutaciones de cuatro enteros contrastadas con oráculo BigInt, 126 valores con cancelación, entradas vacías/incorrectas/desbordamiento y ejecución del código exportado fuera de Atlas. TypeScript sin emisión pasa. No se ha cambiado el juez del entrenador. Esto reduce error en los casos probados, no garantiza aritmética exacta: desbordamiento intermedio sigue rechazándose y decimales/medias mantienen redondeo binario.

La consulta icarus-83 fue rechazada: el revisor recibió entries vacío para program-tools.mjs. Ambos modelos completaron sus pasos, pero no pudo verificar el código existente. Se conserva el rechazo y no se interpreta como aprendizaje ni aplicación. La vuelta ordinaria ya existía para la hora inicial y no se repitió.

Se prepara también la ampliación explícita de scripts/collaboration-evidence.mjs a program-tools.mjs (sólo fuente inspeccionada, sin datos personales). Se regenera snapshot y se prueba la selección por esa ruta y SHA-256 completo. Los cuatro tests de evidencia pasan. El fixture del test de obsolescencia inicialmente no copiaba el segundo archivo y falló por ENOENT; se corrigió para copiar ambas fuentes y sigue exigiendo fallo por contenido alterado, sin relajar el guard. Las tres regresiones de transporte/contexto pasan. Pendiente completar trazabilidad y publicación de la evidencia necesaria antes de otra revisión de esta reparación; no repetir reformulaciones mientras entries siga vacío en producción.

ERAS permanece v13. El análisis de su motor y cámara no produjo un defecto demostrado en esta vuelta; no se modifica ni se anuncia mejora gráfica. Se conserva GitHub main 86b08002ed57a806d3a270f362a326f3ae694dd3, sin sobrescribir trabajo. Atlas v62 conserva su funcionamiento publicado.

Construcción completa npm run build superada, con comprobación previa de ambos archivos del snapshot. No publicada ni subida al repositorio remoto; commit local aislado para continuación. La corrección y el segundo fragmento son candidatos, no capacidades ya desplegadas.

## Integración de ingeniería, 22-11-2026

Se publicó primero una ampliación independiente del instrumento de evidencia (commit fab18ebedaefbfb47692a1834f2408ee8bd5bd84), conservando el algoritmo de estadísticas anterior. Así, el intento icarus-85 recibió el archivo real y sus fuentes públicas; la ausencia de entries que motivó el rechazo 83 quedó resuelta por inspección y despliegue del fragmento. No se altera ni convierte ese rechazo en aprobación.

Icarus-85 terminó evidence-collected: GPT-OSS120B completó una salida, pero no superó consultationProposal (error PROPOSAL); la revisión Qwen quedó unavailable y no se acredita como realizada. No se reintenta para forzar aceptación. La ingeniería manual aplica el código probado y conserva ese fallo. Las fuentes guardadas son source-7a488979952573a89ef9f8c9 y source-73b8f8352bd632f41e70387b. Una opinión del modelo no sustituye la ejecución; tampoco se presenta esta intervención como una propuesta revisada.

Sobre la integración completa pasan 22 pruebas: cuatro de cancelación numérica/exportación, cuatro de la biblioteca previa, siete de herramientas por oficio, cuatro de snapshots y tres de transporte/contexto. Las 24 permutaciones conservan la referencia entera exacta; [1e16,1,-1e16] pasa de total=0/media=0 a total=1/media=1/3. Se mantienen los casos previos, límites, desbordamiento, entrada inmutable y versión exportable autocontenida. TypeScript pasa. El snapshot se regenera otra vez para el algoritmo corregido; la publicación final no conserva un fragmento obsoleto. El juez del entrenador y los baremos no se modifican.

Esta revisión deja de ser sólo candidata cuando el despliegue terminal y su recibo se verifiquen por separado. La mejora acreditada es numérica en los casos ejecutados, no equivalencia con math.fsum, exactitud arbitraria ni entrenamiento de pesos. La inspección de ERAS y sus consumidores no requiere cambios para esta biblioteca de Atlas y conserva v13.
