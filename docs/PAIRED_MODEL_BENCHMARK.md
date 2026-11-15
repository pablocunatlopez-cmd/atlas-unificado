# Atlas: benchmark neuronal emparejado

La comparación de modelos debe hacerse sobre **los mismos casos**, con verificación externa de las respuestas.

## Uso

```js
import {comparePairedRuns} from '../continuous/paired-model-evaluation.mjs';

const baseline=[
 {id:'codigo-1',passed:true,durationMs:1200,ttftMs:180},
 {id:'razonamiento-1',passed:false,durationMs:1300,ttftMs:190},
];
const candidate=[
 {id:'codigo-1',passed:false,durationMs:900,ttftMs:150},
 {id:'razonamiento-1',passed:true,durationMs:950,ttftMs:155},
];
const verdict=comparePairedRuns(baseline,candidate,{minPassRate:0.5});
console.log(verdict.accepted,verdict.regressions); // false, ['codigo-1']
```

## Requisitos antes de automatizar selección

1. Registrar versión del modelo, hash del dataset, cuantización y parámetros de inferencia.
2. Verificar cada respuesta con pruebas deterministas o evaluación humana independiente.
3. Repetir casos estocásticos y registrar dispersión.
4. Añadir métricas de RAM, VRAM, energía y errores de arranque.
5. Ejecutar en la GPU local; este módulo no puede medirla desde GitHub.
6. Mantener revisión humana para activar un modelo o modificar pesos.

El módulo es un filtro de aceptación, no un entrenador ni un sistema de auto-despliegue.
