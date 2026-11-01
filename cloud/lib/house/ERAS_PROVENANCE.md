# Casa Atlas — procedencia y alcance

Base recuperada del proyecto ERAS · Crónicas de la Humanidad del usuario, revisión `8a0fea077ccf84bed54d0b5c384dfc37b6aa4a86`.

- Se reutilizan `dist/mobile-input.js` y `dist/render-engine.js` en `public/house/`, conservando el control analógico circular y la selección de render compatible de ERAS. La casa solicita explícitamente WebGL 2; no anuncia WebGPU ni descarga su motor cuando no lo utiliza.
- `three.module.js`, `three.core.js`, `BufferGeometryUtils.js` y `THREE-LICENSE.txt` proceden del mismo paquete ERAS. Three.js conserva la licencia MIT de sus autores, distribuida junto a los módulos.
- El plano, muebles, vegetación, materiales procedurales y la interacción de las salas se implementan para Atlas. No se incorporan los personajes, HDR, fotogrametría o bibliotecas de movimiento del juego completo.
- El entorno fusiona geometría estática por material, limita la resolución a 1,35× en dispositivos táctiles y 1,5× en escritorio y reduce ese presupuesto cuando mide una cadencia baja. Se pausa cuando la pestaña no es visible y libera texturas, geometría y renderer al cerrarse.
- PNG y vídeo se capturan del lienzo WebGL real. La grabación se limita a 16 segundos y usa MP4 o WebM según los formatos soportados por el navegador. No representa vídeo generado por OpenField ni un modelo neuronal.

El plano y las colisiones se prueban en `lib/house/layout.test.mjs`. La apariencia, los FPS y la grabación requieren comprobación en un navegador con contexto gráfico; las pruebas de geometría no sustituyen esa comprobación.

## Ampliación de procesos y lenguaje

La casa añade una nueva ala con Mente/Archivo, Animal/Cuerpo de Ion, Refutación y LOR-ΩΣ, conectada al plano anterior por cuatro puertas transitables. El observatorio representa Cielo/Constelación: información y agentes con procedencia. Dios/Suceso conserva la apertura a lo que exceda el entendimiento del sistema y las incógnitas, sin reducirse a ese catálogo ni a un revisor omnisciente. Un triángulo tridimensional alrededor del centro de observación conserva el marco de organización; no afirma conciencia ni reconstruye un organigrama visual que todavía no se ha podido observar.

La sala de lenguaje muestra la notación recuperada de Atlas: `S* = ⟨O,A,X,R,T,I,C,E,M,P,F,Σ⟩` y `Γ(t) = ⟨Animal(t), Mente(t), Suceso(t), Realidad(t)⟩`. La interpretación y las pruebas de ese lenguaje pertenecen al núcleo de políticas; las inscripciones 3D son su representación, no su ejecución.

Los habitantes propios de Atlas son figuras humanas para Mente, robots para Ion/programación, un animal explorador residente del laboratorio y aves para Cielo. Su identidad permanece estable por sala aunque cambie el proceso comunicado; el animal permanece visible en reposo cuando no tiene trabajo real. Usan primitivas compartidas en dos mallas instanciadas y una tercera opcional de marcas conservadas. Observar, comprender, conectar, aplicar, refutar y conservar tienen gestos distintos solo con `state: running`, puente conectado y timestamp reciente. Los datos ausentes, futuros, desconectados o de más de 75 segundos desactivan el trabajo; las figuras en espera no respiran ni caminan como si estuvieran ejecutando tareas.

Las marcas junto a Ion representan exclusivamente `experience.counters.accepted`, con un máximo de tres marcas visuales y el número completo en la leyenda. Los ensayos, la actividad de un constructor y el número de fotogramas no añaden marcas ni incrementan contadores. Las esculturas que rotan son ornamentales y así se explica en la interfaz. Mejorar este espejo o su renderer no modifica los pesos de Qwen ni demuestra una mejora en todas las capacidades de Atlas. La escena acepta datos acotados mediante mensajes del padre con origen y ventana comprobados.

Las pruebas de estado verifican rechazo de campos arbitrarios, contadores inválidos, telemetría caducada y ausencia de movimiento de trabajo sin actividad. La prueba de escena construye la geometría real de Three.js, comprueba los puntos de aparición contra muebles y paredes y mantiene un presupuesto de mallas; usa un destino de texturas simulado y no sustituye la comprobación visual WebGL.
