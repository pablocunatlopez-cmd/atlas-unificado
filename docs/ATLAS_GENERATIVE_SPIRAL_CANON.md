# Atlas — teoría canónica de la espiral generativa

## Definición del autor (2026-11-16)
La espiral es un **ciclo de vida dentro de los vértices de comprensión**: Mundo Mental, Mundo Físico y Dios/Suceso. El tercer vértice no es una personificación religiosa: designa un acontecimiento inesperado que puede exigir reescribir la interpretación del sistema.

**No son espirales concéntricas decorativas.** De cada espiral pueden surgir otras espirales en la dirección **tangente** de sus puntos. Los intervalos entre sucesos son lo que el modelo denomina **tiempo**. La estructura de crecimiento toma como referencia el número **e** y las estrategias de exploración y adaptación a recursos limitados observadas en redes miceliales.

## Distinción entre axioma conceptual y formalización matemática propuesta
- Axioma conceptual: ciclo de vida, tangencia local, sucesos e intervalos, ramificación adaptativa y tres vértices.
- Formalización candidata (revisable): trayectoria madre diferenciable S(u), tangente unitaria T(u)=S'(u)/||S'(u)||. Una rama hija B(v) nace en B(0)=S(u₀), con B'(0) paralelo a T(u₀). La geometría posterior de la rama no está fijada por la tangencia inicial.
- Formalización candidata del crecimiento: magnitudes positivas pueden evolucionar como R(t)=R₀ exp(k t), con k dependiente de recursos. El número e por sí solo **no determina** la forma espacial, el patrón de ramificación ni la biología de un hongo.
- Formalización candidata del tiempo: sucesos Eᵢ con orden y duración Δtᵢ=tᵢ₊₁−tᵢ. Si el modelo pretende que el tiempo **emerja** únicamente de los sucesos, todavía falta definir una regla independiente para medir esos intervalos; no se debe presuponer un reloj externo como explicación completa.
- Restricciones de recursos: presupuesto finito, costes por rama, umbral de supervivencia, exploración y consolidación; evitar crecimiento exponencial ilimitado.
- El acontecimiento Dios/Suceso puede disparar una **propuesta de reinterpretación**, nunca reescribir automáticamente hechos, memoria o decisiones aprobadas.

## Consecuencias para implementación
1. Sustituir la actual representación de tres hélices concéntricas de `cloud/public/house/atlas-spiral-layer.js` por un generador de ramas tangentes.
2. Separar motor matemático puro, estado de recursos y visualización Three.js; usar semillas deterministas y límites estrictos de profundidad/número de ramas.
3. Representar los sucesos como nodos fechados u ordenados y los intervalos como aristas de duración explícita.
4. Mantener el triángulo de comprensión como marco conceptual, sin reemplazarlo por los nodos históricos Animal/Mente/Logos.
5. Probar continuidad tangencial, conservación del presupuesto de recursos, límites de crecimiento y ausencia de bucles infinitos.
6. No presentar la inspiración micelial como una equivalencia científica demostrada: es una hipótesis de diseño a contrastar.

**Estado:** especificación conceptual registrada; la geometría actual aún no implementa este modelo. No se ha ejecutado código.
