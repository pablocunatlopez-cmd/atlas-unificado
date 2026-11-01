# Verificación de la distribución

El árbol compartible contiene código fuente, configuración de ejemplo y pruebas. No es una copia de la instalación privada. Su exportador usa una lista explícita de módulos y excluye datos de ejecución, pesos Qwen, checkpoints locales, memoria SQLite, informes privados, claves, capturas y paquetes de dependencias. La carpeta `cloud/data` es una excepción explícita: siete semillas estáticas de la versión original ya publicada en Sites, necesarias para compilar `/origen`, sin registros vivos de usuarios.

Las adaptaciones sustituyen el import local de QuickJS por una dependencia npm; hacen configurables Python y la biblioteca de juegos; eliminan referencias a conversaciones y rutas personales; reemplazan los prompts privados por una semilla genérica que conserva el bucle de seis fases. No modifican el coordinador activo de origen.

Validación ejecutada con Node.js 22.20.0:

- 226 pruebas Node aprobadas desde este árbol tras incorporar las reservas GPU, el puente creativo y el proveedor Wan, sin iniciar otro servidor ni entrenador durante las pruebas.
- Preparación desde un directorio temporal vacío: configuración y clave local creadas, activos Three.js reconstruidos desde npm y segunda ejecución idempotente. La clave no se imprimió ni se creó en este árbol fuente.
- Escaneo de patrones de credenciales, claves privadas, correos personales y rutas de usuario: cero hallazgos en los archivos compartibles. Es una comprobación preventiva, no una garantía universal de ausencia de información sensible.

`source-export-manifest.json` registra los archivos copiados y sus adaptaciones. `github-upload-manifest.json` enumera los archivos exactos autorizados para el commit, incluidos README, scripts y lockfile. `node_modules/` solo se usa para comprobar las pruebas y debe permanecer fuera de Git.

El modelo Qwen y los checkpoints ATLAS-LM no se redistribuyen. La inferencia requiere un servidor llama.cpp configurado y autorizado por el propietario. Este árbol no convierte GitHub en un alojamiento GPU ni migra automáticamente las conversaciones privadas a la nube.

## Fuente de nube incorporada

`cloud/` contiene la aplicación Sites/Vinext, interfaz móvil, rutas de cola, esquema y migraciones D1, componentes históricos de `/origen`, estilos y licencias necesarias. TypeScript y las pruebas de la cola pasaron desde esta copia, utilizando temporalmente una instalación de dependencias existente; el enlace temporal se retiró antes de preparar la lista de subida.

Las siete semillas estáticas originales se revisaron sin encontrar credenciales, correos personales ni rutas de usuario. El único enlace identificador de una conversación privada, en `continuity.json`, se sustituyó por `#origen` solo en esta distribución. La semilla del pequeño MLP original ya publicado en Sites se conserva por compatibilidad; no son pesos Qwen ni checkpoints privados del PC. `docs/cloud-export-manifest.json` documenta esa excepción y sus hashes.
