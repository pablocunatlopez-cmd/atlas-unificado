import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from '../data/character-network.json' with {type:'json'};
import {rankCharacters} from '../lib/collaboration/character-network.ts';
import {MISSIONS,missionFor} from '../lib/collaboration/missions.ts';
test('Salidas canónicas sin convertir edificios ni delegados en personajes adicionales',()=>{
 assert.deepEqual(net.ids,MISSIONS.filter(m=>['resident','character'].includes(m.kind)).map(m=>m.id));
 for(const id of net.ids){assert.ok(missionFor('resident:'+missionFor(id)!.residentId));}
});
test('encargos redactados fuera del corpus: especialidades y personaje ERAS',()=>{
 for(const [brief,id] of [['Evita el recorte en mi mezcla','resident:music-mixer'],['Ajusta el ritmo de montaje entre los planos','resident:cinema-audience-6'],['Necesito etiquetas accesibles para teclado','resident:cinema-audience-5'],['Busca a la exploradora que recorre el valle','eras-character:ice:scout']]){
 assert.equal(rankCharacters(net,brief)[0],id,brief);}
});
test('abstención y entradas sin vocabulario: no asignar al primer personaje',()=>{
 assert.equal(rankCharacters(net,'constructor')[0],'resident:games-desk'); // Talo es el constructor en español.
 for(const s of ['','zxqv','quiero ayuda','__proto__ toString','💬'])assert.deepEqual(rankCharacters(net,s),[]);
});
