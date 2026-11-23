import test from 'node:test';import assert from 'node:assert/strict';
import {createHouseQuest,advanceHouseQuest,housePrototypeRequest,housePrototypeHref} from '../../public/house/house-quest.js';
import {houseFunction} from '../../public/house/functional-world.js';
test('the house game requires connected archive, specialist, review and integration actions',()=>{
 for(const brief of ['Construir una casa','Un juego de música','Un videojuego de cine']){let q=createHouseQuest(brief);const original=structuredClone(q);assert.equal(advanceHouseQuest(q,'lia-core').accepted,false);assert.deepEqual(q,original);assert.equal(advanceHouseQuest(q,'invented').accepted,false);for(const task of q.tasks){assert.ok(houseFunction(task.id));const result=advanceHouseQuest(q,task.id);assert.equal(result.accepted,true);q=result.state;}assert.equal(q.completed,true);assert.equal(q.inventory.length,4);assert.equal(advanceHouseQuest(q,'lia-core').accepted,false);assert.equal(createHouseQuest(brief).step,0);}
});
test('only explicit house game requests use the concrete prototype and URLs encode the brief',()=>{assert.equal(housePrototypeRequest('Haz un videojuego en la casa de Lía'),true);assert.equal(housePrototypeRequest('Hablemos de mi casa'),false);assert.equal(housePrototypeRequest('Haz un videojuego de coches'),false);assert.equal(housePrototypeRequest('No quiero que hagas un videojuego de mi casa'),false);assert.equal(housePrototypeRequest('Explica cómo crear un videojuego de una casa'),false);assert.ok(!housePrototypeHref('casa (Lía)').includes('('));assert.ok(!housePrototypeHref('<script>').includes('<'));assert.ok(housePrototypeHref('a'.repeat(4000)).length<700);});
test('questions and requests for explanations are not replaced by a game link',()=>{
 for(const question of ['Quiero saber si puedes crear un videojuego en la casa de Lía','Quiero que me expliques cómo crear un videojuego en una casa','Crea una lista de ideas para un videojuego en casa','Haz un análisis del videojuego de la casa de Lía','Quiero un guion para un videojuego en mi casa','Programa una reunión para hablar de un videojuego en casa'])assert.equal(housePrototypeRequest(question),false,question);
});
test('direct game requests may also ask for controls or an explanation',()=>{
 for(const question of ['Haz un videojuego en la casa de Lía y explica los controles','Por favor, crea un juego de música en casa','Quiero que me hagas un videojuego en la habitación','Haz un pequeño juego en la casa de Lía'])assert.equal(housePrototypeRequest(question),true,question);
});
