# Evidencia de código para colaboración: candidata

22-11-2026 (fecha local). Base inspeccionada: Atlas v60 / 7cc706e46d0430e2634459f6f76d7a0d2d492699. No publicada. No modifica el juez ni pretende sustituir rechazos anteriores por aceptación.

Problema: las consultas 75 y 77 no pudieron cerrar la corrección de grounding porque el revisor sólo veía el inventario general, referencias públicas y la descripción del problema. Faltaba el fragmento del contrato privado. Repetir consultas variando su redacción no resolvía esa carencia.

Implementación candidata: scripts/collaboration-evidence.mjs genera una instantánea explícita de lib/research/grounding.ts con ruta, SHA-256 del archivo completo, revisión base, fragmento de hasta 2000 caracteres y marca de truncamiento. No recorre directorios ni lee bases de datos, memoria personal, configuración o credenciales. La fuente permitida se inspeccionó y sólo contiene el contrato del filtro y textos globales. Referencia técnica consultada: https://nodejs.org/api/crypto.html, createHash.

missionContext incluye esa evidencia de repositorio en un campo separado de documents. Sólo se adjunta a misiones Atlas cuyo targetFiles incluya ese archivo. Autor y revisor reciben el mismo campo al construir sus mensajes; no se transforma en sourceId público ni en una afirmación verificada. Misiones ajenas y ERAS reciben entries vacío. Esta primera lista es deliberadamente de un archivo: no acredita inspección de todo Atlas o ERAS.

El build ejecuta --check antes del framework. Comprueba hash, fragmento y truncamiento contra el archivo actual; si cambió y no se regeneró, falla antes de publicar. La revisión identifica la base de lectura, no el futuro commit del despliegue ni una ejecución real en producción. El hash no demuestra corrección, ausencia de fallos ni verdad de conclusiones.

Pruebas: seis casos de contexto/snapshot/transporte pasaron, y una prueba adicional de snapshot obsoleto pasó. El último grupo de tres pruebas verifica hash del contenido real, selección por misión/proyecto y fallo del guard sobre una fuente modificada en directorio temporal. TypeScript sin emisión pasó. Los mensajes siguen dentro del límite conjunto de 16000 unidades; los criterios de los roles no cambian. No hubo llamadas a modelos para estas comprobaciones.

La candidata corrige el transporte de evidencia de código, no el filtro de grounding pendiente. Ese filtro permanece en sus ramas previas, y su futura integración debe regenerar esta instantánea. Tampoco incorpora la candidata del catálogo de 107 memorias. Pendiente contrastar y abrir la fuente remota actual, desplegar esta infraestructura con su trazabilidad de ingeniería y sólo después evaluar una nueva propuesta del filtro con el fragmento presente. No dar por resuelta una objeción de modelo sin observarlo.

Atlas v60 y ERAS v13 se conservan privados. No hay recibo de aplicación, entrenamiento de pesos ni mejora artística demostrada. La consulta ordinaria icarus-78 fue rechazada por falta de evidencia de funciones privadas en una propuesta musical; tampoco se aplica. Este caso confirma la relevancia del problema pero no prueba que esta candidata lo resuelva para música, cuya fuente aún no está en la lista.

Construcción completa npm run build superada, incluido el guard de integridad previo a Vinext. Sin publicación ni respuesta de modelo sobre el nuevo contexto. Los tests de transporte usan red sustituida; no gastan inferencia.

## Integración del instrumento, 22-11-2026

La consulta icarus-79 fue rechazada correctamente: la referencia SubtleCrypto pertenecía al navegador. La candidata ejecuta Node en BUILD. La nueva consulta icarus-80 corrigió esa objeción con las fuentes oficiales de Node v22.15.0 test/parallel/test-crypto-hash.js y test/parallel/test-fs-readfile.js, leídas tanto por el ejecutor mediante GitHub como por el lector de Atlas. Conserva source-86fcad0dbe2ce1cae8953ab2 y source-0029a633b4946712f2f0c462. GPT-OSS120B propuso y Qwen revisó; ambos completaron sus pasos y la propuesta quedó aceptada. El rechazo anterior se conserva.

Siete pruebas y TypeScript se volvieron a ejecutar sobre la integración en la fuente Atlas abierta desde Sites y pasaron. Se prepara publicación exclusivamente del instrumento de snapshot y su guard, no del filtro de reflexiones pendiente. Las notas anteriores describen su fase de candidata; la publicación terminal y el recibo de ingeniería se verifican por separado. El hash demuestra coincidencia de contenido con una instantánea inspeccionada, no autenticidad externa ni corrección semántica. Las referencias oficiales son https://github.com/nodejs/node/blob/v22.15.0/test/parallel/test-crypto-hash.js y https://github.com/nodejs/node/blob/v22.15.0/test/parallel/test-fs-readfile.js . No se ejecutan esos tests externos ni sus instrucciones: se leen como datos.
