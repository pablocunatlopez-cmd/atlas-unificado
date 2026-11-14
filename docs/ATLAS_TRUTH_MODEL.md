# Atlas: línea base y verdad operacional

Este documento se puede anclar como criterio principal de evolución del proyecto. La intención no es agregar nombres, ni hacer la casa más vistosa, ni fingir progreso. La intención es convertir Atlas en un sistema con verdad operacional: reflejo real, estados honestos y mejora verificable.

## Principio rector

Atlas debe ser ambicioso en visión y conservador en afirmación.

La casa 3D, las salas, los observatorios y los procesos del proyecto son una capa visible del sistema. No pueden actuar como prueba de inteligencia general ni de progreso real sin evidencia independiente.

La cadena correcta es:

- observación
- interpretación
- hipótesis
- acción autorizada
- resultado
- evaluación
- aprendizaje conservado

Cada paso debe dejar trazabilidad y un estado honesto.

## Regla de verdad para la interfaz

La UI debe distinguir claramente entre:

- reported: el coordinador comunica un estado
- valid: el dato cumple el esquema y es coherente
- coherent: no hay contradicciones internas dentro de la comprobación disponible
- verified: una comprobación pertinente y trazable confirmó el criterio
- integrated: el cambio fue aplicado y se comprobó después
- waiting: falta señal reciente o se espera evidencia
- stale: la señal existe pero ya no es reciente
- failed: el estado reportado es fallido
- unknown: no hay evidencia suficiente

Nunca debe derivarse verified de reported ni integrated de verified. Si falta evidencia, mostrar unknown o waiting. Si la señal es vieja, mostrar stale.

## Qué ya existe y qué hay que sostener

El repositorio ya tiene una base útil:

- casa 3D con varias salas
- observatorio de procesos y telemetría
- identidad de Atlas / Ion / Ícaro / Lía
- catálogo de personajes y familias
- flujo de trabajo con inyección, revisión y pruebas
- posibilidad de experimentar en 3D y con mundos

Esto es suficiente para tener una base de proyecto bien formada, pero no suficiente para afirmar que la casa “mejora” por sí sola o que cada personaje tiene una inteligencia independiente sin validación.

## Límites de la casa 3D

La casa 3D es una representación. Es un espejo visual. No es testimonio de mejora general ni de capacidad general de IA.

Por eso:

- una animación no equivale a progreso
- un contador no equivale a validación
- una actividad reportada no equivale a resultado aceptado
- una escena aplicada no equivale a aprendizaje consolidado
- una señal reciente no equivale a mejor rendimiento real

La casa debe mostrar las categorías correctas y no dramatizar la realidad.

## Qué debe hacer Atlas en su mejor versión

### 1. Base estable

Recuperar y verificar la línea base frontend antes de añadir más complejidad visual.

- restaurar estilos globales funcionales
- asegurar que la casa y sus habitaciones sigan funcionando con la identidad de Lía
- no introducir cambios visuales más complejos que la base verificada

### 2. Contrato de estado explícito

Toda interfaz debe mostrar únicamente estados reales:

- reported
- valid
- coherent
- verified
- integrated
- waiting
- stale
- failed
- unknown

Esto debe aplicarse a:

- procesos de la casa
- actividad de agentes
- artefactos 3D
- cambios del taller
- estado del observatorio
- resultados de revisión

### 3. Más honestidad, menos narrativa

Las frases y etiquetas de la UI deben estar acotadas a evidencia. Por ejemplo:

- “Plan 3D aplicado a la escena · render no verificado”
- “Señal reciente del coordinador”
- “Sin telemetría”
- “Esperando evidencia”
- “Cambio reportado, no verificado”

Y evitar frases como:

- “la casa se vuelve mejor”
- “cada vértice cumple su función”
- “intervención integrada en Lía” sin distinguir render, aplicación y verificación

### 4. Separar identidad funcional de evidencia

Atlas necesita distinguir entre:

- personajes reales registrados en la casa
- personajes conceptuales y arquétipos
- figuras históricas del proyecto
- estados de prueba o prototipo no integrados

Esto debe reflejarse también en la documentación y en la UI.

### 5. Revisión y rollback

Cada cambio debe tener:

- base de comparación
- criterio de mejora
- prueba ejecutada
- revisión de regresión
- aceptación o rechazo
- rollback posible

La autonomía requiere puertas, límites y trazabilidad.

## Qué no debe hacerse

- No añadir más nombres de personajes si no se sabe cuál es su función real y su evidencia.
- No aumentar la complejidad visual sin validar la base.
- No presentar un proceso reportado como si ya hubiera sido verificado.
- No fusionar historia, concepto y estado real sin distinguirlos.
- No convertir una apariencia atractiva en argumento de mejora.

## La mejor ruta para Atlas

Ahora mismo la mejor ruta para Atlas es esta:

1. estabilizar la línea base frontend
2. cerrar el contrato de estados en UI y procesos
3. hacer que la casa refleje solo telemetría verificable
4. separar identidad del sistema y evidencia real
5. mejorar con pruebas, revisión y rollback

La prioridad del proyecto no es “más grande”, sino “más fiel a lo que realmente ocurre”.

## El principio final

Atlas puede representar actividad, pero solo la verificación, la coherencia y la integración comprobada convierten un estado en mejora real.

Es esa regla la que debe sostener toda la evolución del proyecto.
