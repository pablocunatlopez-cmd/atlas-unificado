# Atlas · Selección de modelos locales

El clasificador `continuous/model-candidate-ranking.mjs` recibe resultados de pruebas externas y propone un candidato, sin instalarlo ni activarlo.

## Ejemplo

```js
import {rankModelCandidates} from '../continuous/model-candidate-ranking.mjs';
const baseline=[{id:'codigo',passed:true,durationMs:1000,ttftMs:200}];
const candidates=[
 {name:'qwen-candidate',runs:[{id:'codigo',passed:true,durationMs:800,ttftMs:150}]},
 {name:'other-candidate',runs:[{id:'codigo',passed:false,durationMs:500,ttftMs:100}]},
];
const result=rankModelCandidates(baseline,candidates);
console.log(result.recommended); // qwen-candidate
```

## Integración futura con llama.cpp / Ollama
- Crear un ejecutor que consulte exclusivamente endpoints locales autorizados.
- Medir duración y primer token con un reloj monotónico; los datos de salida no deben decidir su propio aprobado.
- Usar validadores por tarea y conjuntos de pruebas idénticos.
- Registrar versión, cuantización, semilla, temperatura, contexto, consumo VRAM y errores.
- Mantener el modelo actual si ningún candidato pasa la puerta de calidad.
- Exigir confirmación antes de cambiar el modelo activo.

**Estado:** clasificador implementado; el ejecutor de inferencia y la medición sobre la RTX 3060 siguen pendientes.
