# Autonomía de Atlas — 1 de noviembre de 2026

La prioridad vigente es mejorar la autonomía antes que ampliar el 3D. El proyecto mantiene un coordinador y una instancia de Qwen local; no depende de preguntas a Codex para ejecutar sus ciclos.

- **Colaboradores de programación:** Aider 0.86.2 y generador nativo disponibles para selección automática por contratos y exploración acotada. Aider se comprobó con una herramienta de 8/8 contratos. Ambos usan el mismo Qwen, sin independencia entre modelos ni necesidad de OpenRouter o activación por turno.
- **Política del núcleo:** generación DSL activa 1, mejora observada de 8/9 a 9/9 contratos. El alcance es una estrategia modificable y reversible; no edición arbitraria del servidor.
- **LOR-ΩΣ:** Qwen creó la herramienta estructural de S* y aprobó 8/8 contratos externos. Se conservan O,A,X,R,T,I,C,E,M,P,F,Σ, con E=escala y A=ambiente. Comprueba presencia de claves y extras; los valores presentes con null siguen presentes. No valida teorías físicas.
- **Pesos Qwen9B:** entrenamiento LoRA real de ocho pasos y 4,19 millones de parámetros entrenables; exportación GGUF producida. Resultado 4/8 → 4/8, sin mejora. El adaptador no está activo y se conserva el modelo base.
- **Continuidad:** el proceso autónomo prepara datos de herramientas cuyos contratos vuelve a ejecutar. Los ensayos requieren datos nuevos y al menos seis horas entre intentos; el chat tiene prioridad. Una repetición sin datos nuevos no cuenta como aprendizaje.
- **Acceso compartido:** Sites público V10, commit 9db1f5d0b0e074e2a453d145854994a3ec4403c5, casa de diez salas. Repositorio privado creado: https://github.com/pablocunatlopez-cmd/atlas-unificado. Solo se comparten funciones públicas canónicas ejecutadas en QuickJS, sin memoria ni controles privados; la GPU sigue en el PC.

La prueba HTTP real del acceso público ejecutó la herramienta LOR (`toolUsed:true`) y detectó `missing:["E"]`. La respuesta mantuvo memoria y fuentes privadas en cero. El intento de control `/atlas parar` fue rechazado con HTTP 400 desde esa sesión compartida.

Las pruebas focalizadas de currículo, programación autónoma y modos de generación pasaron 34/34, sin utilizar GPU ni red. Esto comprueba los contratos y regresiones ensayados; no acredita superioridad general sobre otros asistentes. No hay instalación automática de extensiones de VS Code ni modificación autónoma arbitraria del servidor.

Actualización 17:13 UTC: Sites V11 publicado, commit 38849b3e8b063af91eeeeaff5c054b641128e14f. smolagents 1.26.0 conectado al Qwen local: 0/2 tareas aprobadas, fallos conservados. Aider 2/2 y nativo 1/1 en el registro actual. Política activa generación 2, 103 propuestas y dos promociones. Tres candidatos de pesos entrenados en total, dos mediante el coordinador autónomo, sin adaptador activado. Esto acredita continuidad observada sin Codex; no mejora de pesos demostrada.
