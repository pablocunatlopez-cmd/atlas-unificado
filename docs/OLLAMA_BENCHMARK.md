# Atlas · Ollama benchmark local

Se han añadido `continuous/local-ollama-evaluation.mjs` y `continuous/ollama-benchmark-runner.mjs`.

Ejemplo (requiere Ollama instalado y modelo disponible en el PC):

```js
import {evaluateOllamaCases} from './continuous/ollama-benchmark-runner.mjs';
import {comparePairedRuns} from './continuous/paired-model-evaluation.mjs';

const cases=[
  {id:'aritmetica',prompt:'Responde solo con el número: 2+2',expected:'4'},
  {id:'capital',prompt:'Responde solo con una palabra: capital de Francia',expected:'París'},
];
const baseline=await evaluateOllamaCases({model:'qwen2.5:7b',cases,options:{temperature:0,seed:42}});
const candidate=await evaluateOllamaCases({model:'another-local-model',cases,options:{temperature:0,seed:42}});
console.log(comparePairedRuns(baseline,candidate,{minPassRate:0.5}));
```

Advertencias:
- El benchmark actual verifica coincidencia exacta, apropiada solo para respuestas deterministas; NO mide calidad general, creatividad o razonamiento abierto.
- La API se consulta en `http://127.0.0.1:11434` por defecto. No se permiten servidores remotos.
- La API de generación se usa sin streaming; **no hay medida real del tiempo hasta el primer token**. El runner asigna el tiempo total como límite superior conservador para satisfacer el formato del evaluador. No interpretar `ttftMs` como TTFT observado.
- La duración incluye transporte y espera; `providerTotalMs` es la métrica adicional informada por Ollama.
- No se han ejecutado pruebas sobre la RTX 3060 desde GitHub; es necesario ejecutarlas en el PC con los modelos instalados.
- No habilita selección ni despliegue automático.
