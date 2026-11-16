# Espiral de Atlas — especificación operacional v1

## Tres vértices, no cuatro
1. **Mundo Mental — Atlas**: recuerdos, modelos, inferencias y predicciones, siempre con incertidumbre.
2. **Mundo Físico — Ion**: observaciones comprobables, resultados de herramientas y acciones autorizadas. Una intención no es una ejecución.
3. **Dios — Suceso**: aquello que no encaja en el modelo vigente y puede obligar a reescribirlo. No presupone religión, omnisciencia, conciencia artificial ni un evento objetivamente inexplicable.

**Constelación** es un conjunto de perspectivas, fuentes y agentes que puede ayudar a contrastar un suceso; no sustituye al tercer vértice ni crea un cuarto.

## Tiempo en la tangente
Sea una trayectoria interpretativa `S(t)`. En una representación geométrica suave, la tangente local es `dS/dt`, pero Atlas no dispone de una medición física continua de esa trayectoria. La implementación usa sucesos discretos `E_i` con tiempo `t_i` y diferencia `Δt=t_i-t_(i-1)>0`. `spiralTangent` identifica qué vértices han cambiado y conserva el intervalo temporal, **sin afirmar derivadas físicas, velocidades psicológicas ni causalidad**.

## Protocolo por acontecimiento
1. **Pregunta y predicción**: registrar el modelo mental antes de observar.
2. **Ion / observación**: registrar qué se ha observado realmente, con pruebas si existen.
3. **Dios / sorpresa**: registrar el desajuste o lo todavía inexplicable, sin convertirlo en certeza.
4. **Tangente temporal**: comparar con el acontecimiento anterior y señalar los vértices modificados.
5. **Revisión**: añadir un nuevo registro enlazado al anterior; nunca alterar la evidencia histórica.
6. **Siguiente pregunta**: seleccionar una hipótesis falsable, una observación posible y sus permisos.

## Estado de implementación
- `continuous/atlas-spiral-time.mjs` implementa el modelo puro de registros, tangentes discretas y revisiones inmutables.
- `continuous/atlas-identity.mjs` incorpora los tres vértices y la tangente al prompt vigente que consume el motor conversacional principal.
- La nueva estructura **no está todavía conectada a almacenamiento persistente ni al ciclo de ejecución autónoma**. No afirmar que ya mide el tiempo de la mente, detecta novedades automáticamente o reescribe pesos de modelos.
- La cola cloud y el chat canónico siguen siendo los existentes; esta integración no añade otra interfaz ni un agente paralelo.

## Criterios de aceptación siguientes
- Adaptador de eventos a almacenamiento privado con identidad, consentimiento y control de versiones.
- Evidencias enlazadas a ejecuciones reales de Ion, no relatos del modelo.
- Evaluación de contradicciones con controles negativos y reversibilidad.
- Visualización cronológica de tangentes con incertidumbre y origen de cada dato.
