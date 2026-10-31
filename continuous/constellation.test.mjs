import test from 'node:test';import assert from 'node:assert/strict';import {freeStars,requireFreeStar} from './constellation.mjs';
test('la constelación solo muestra texto gratuito con ambos precios en cero',()=>{
 const base={id:'a/model:free',name:'A',pricing:{prompt:'0',completion:'0'},architecture:{output_modalities:['text']}};
 assert.deepEqual(freeStars([base,{...base,id:'paid/model'},{...base,pricing:{prompt:'0',completion:'1'}},{...base,pricing:{}},{...base,architecture:{output_modalities:['image']}}]).map(x=>x.id),['a/model:free']);
});
test('la selección de modelos de pago se bloquea',async()=>{await assert.rejects(requireFreeStar('paid/model',()=>{throw Error('No debe llamar');}),/gratuitos/);assert.equal(await requireFreeStar('openrouter/free'),'openrouter/free');});
