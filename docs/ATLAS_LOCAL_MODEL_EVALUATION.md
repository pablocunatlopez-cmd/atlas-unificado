# Evaluación local de Atlas (CPU)

Módulo: `continuous/atlas-local-model-evaluator.mjs`.

Ejecuta una batería acotada de casos con `id`, `prompt` y `expected` usando una función `infer` inyectada por el anfitrión. **No inicia ningún modelo ni descarga nada.** Devuelve el porcentaje de coincidencias exactas, tiempos por caso y errores.

Ejemplo con llama.cpp previamente iniciado en `127.0.0.1:8080`:

```js
import {evaluateAtlasLocalModel} from './continuous/atlas-local-model-evaluator.mjs';
import {queryAtlasLocalLlama} from './continuous/atlas-local-llama-client.mjs';

const report=await evaluateAtlasLocalModel({
  infer:prompt=>queryAtlasLocalLlama({
    messages:[{role:'user',content:prompt}],maxTokens:32
  }),
  cases:[{id:'saludo',prompt:'Responde exactamente: OK',expected:'OK'}]
});
console.log(report);
```

**Limitaciones:** una coincidencia exacta no verifica razonamiento, precisión factual ni seguridad. Los tiempos dependen del anfitrión y de la carga del sistema. La identidad del modelo no se verifica. No se envían resultados a servicios externos. No utilizar la puntuación para aprobar cambios automáticos sin revisión humana.
