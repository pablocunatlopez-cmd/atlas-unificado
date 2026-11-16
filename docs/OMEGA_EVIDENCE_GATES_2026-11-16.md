# Atlas Ω — Contrato de evolución verificable (2026-11-16)

## Propósito
Atlas es una arquitectura experimental de inteligencia, creación y revisión del conocimiento. El sistema **no** debe confundir una animación, una explicación convincente, una prueba ejecutada o una propuesta con una mejora de inteligencia validada.

## Ontología canónica de la Espiral
- **Mundo Físico**: observaciones y sucesos externos; incluir fuente, instante, método y límites de observación.
- **Mundo Mental**: hipótesis, interpretaciones, modelos, preguntas y predicciones.
- **Dios / Suceso**: nombre filosófico del acontecimiento inesperado o inicialmente inexplicable que obliga a revisar un modelo. No equivale a una entidad sobrenatural demostrada ni a un error de software automáticamente.
- Ciclo: observación → hipótesis → predicción → contraste → anomalía → revisión → nuevo contraste.
- Una anomalía puede resultar de ruido, medición defectuosa, cambio real o modelo incorrecto; Atlas debe mantener alternativas y no forzar una explicación.

## Estados obligatorios
PROPOSED → IMPLEMENTED → TESTED → BENCHMARKED → ACCEPTED → DEPLOYED.
Estados terminales: REJECTED, ROLLED_BACK. Cada transición registra actor, commit, timestamp, artefactos y evidencia. Ningún contador de actividad implica ACCEPTED.

## Criterios para aceptar una mejora
1. Baseline fijada por commit y entorno; conjunto de evaluación separado de los ejemplos usados para construir el cambio.
2. Pruebas de regresión y seguridad pasan. Si una prueba no se ejecutó, marcar NOT_RUN; nunca PASS.
3. Comparación A/B sobre las mismas tareas, con métricas de calidad, latencia, memoria, coste y tasa de fallos.
4. Prohibir filtración del conjunto de evaluación al generador. Registrar incertidumbre y resultados negativos.
5. Revisión humana para cambios de permisos, red, ejecución de código, datos privados, publicación y despliegue.
6. Despliegue gradual y rollback verificable. Sin señal de despliegue, no declarar mejora de Sites.

## Contrato de evento de evidencia
```json
{
  "event_id": "uuid",
  "candidate_commit": "git-sha",
  "baseline_commit": "git-sha",
  "component": "coordinator",
  "state": "TESTED",
  "test_suite": "tests/coordinator",
  "test_result": "PASS",
  "benchmark_result": "NOT_RUN",
  "security_result": "NOT_RUN",
  "runtime": "node-version",
  "timestamp": "ISO-8601",
  "evidence_paths": [],
  "reviewer": null
}
```

## Fronteras técnicas
- **Sites**: interfaz, autenticación, visualización y cola de trabajos; no atribuirle inferencia local sin puente operativo.
- **GitHub**: código, revisiones, CI y artefactos; no es el motor de inferencia.
- **Local futuro**: llama.cpp/Qwen y laboratorios opcionales; no suponer GPU disponible.
- **LOR-ΩΣ**: evaluación y memoria de intentos con resultados negativos; no atribuir autoconciencia.
- **ERAS**: motor creativo 3D y herramientas; distinguir prototipo procedural de gráficos AAA.
- **Agentes**: constructor y revisor que usan el mismo modelo no son evidencia de independencia.

## Backlog priorizado
P0: comprobar workflow CI real, tests reproducibles, permisos del puente y seguridad de ejecución; corregir cualquier bypass de consentimiento.
P1: emitir eventos de evidencia por cada candidato; panel de estado que distinga IMPLEMENTED, TESTED y DEPLOYED.
P2: banco de 100 tareas versionadas (programación, refutación, herramientas, memoria y creación); baseline y A/B con intervalo de confianza.
P3: integrar la Espiral como registro de hipótesis, predicciones, anomalías y revisiones, sin afirmaciones metafísicas automáticas.
P4: mejorar interfaz de la casa 3D por presupuesto de rendimiento móvil; medir FPS, memoria, tiempos de carga y accesibilidad.
P5: publicar en Sites solo tras validar build, migraciones, permisos y rollback.

## Definición de terminado
Un cambio está terminado únicamente si su evidencia es recuperable, la regresión es verde, sus limitaciones se declaran y la versión desplegada está identificada. Los cambios no probados permanecen explícitamente pendientes.
