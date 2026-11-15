import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVideoPlan,videoPrompt} from '../lib/cinema/director.ts';
const plan={version:1 as const,title:'Un regreso a Lía',synopsis:'Una visita a las fuentes regresa al salón y transforma la perspectiva.',style:'Ritmo tranquilo y cierre cercano.',narration:'Volvemos con una pregunta mejor.',shots:[{room:'constellation',seconds:3,framing:'wide' as const,movement:'orbit' as const,description:'Presentar la constelación como apertura.',narration:'Buscamos otra perspectiva.'},{room:'salon',seconds:5,framing:'detail' as const,movement:'push' as const,description:'Acercarse al centro del entorno de Lía.',narration:'El resultado vuelve a casa.'}],seconds:8,captureRequired:true as const};
test('the director preserves an actual shot order, unequal timing and distinct camera operations',()=>{
 const value=validateVideoPlan(plan);assert.deepEqual(value.shots.map(s=>s.seconds),[3,5]);assert.equal(value.seconds,8);assert.deepEqual(value.shots.map(s=>s.movement),['orbit','push']);assert.deepEqual(value.shots.map(s=>s.framing),['wide','detail']);assert.notEqual(value,plan);
});
test('different valid stories retain their own scene sequence instead of selecting a fixed preset',()=>{
 const music=validateVideoPlan({...plan,title:'La memoria se convierte en ritmo',shots:[{...plan.shots[0],room:'mind',framing:'medium',movement:'still',seconds:4},{...plan.shots[1],room:'music',framing:'wide',movement:'orbit',seconds:6}],seconds:10});
 assert.notDeepEqual(music.shots,validateVideoPlan(plan).shots);assert.equal(music.shots[1].room,'music');assert.equal(music.seconds,10);
});
test('unknown scenes, unsupported camera commands and inconsistent or unbounded durations fail closed',()=>{
 for(const raw of [{...plan,seconds:10},{...plan,shots:plan.shots.slice(0,1)},{...plan,shots:[{...plan.shots[0],room:'beach'},plan.shots[1]]},{...plan,shots:[{...plan.shots[0],movement:'fly'},plan.shots[1]]},{...plan,shots:[{...plan.shots[0],seconds:0},plan.shots[1]]},{...plan,shots:[{...plan.shots[0],seconds:10},plan.shots[1]],seconds:15},{...plan,model:'diffusion'},{...plan,captureRequired:false}])assert.throws(()=>validateVideoPlan(raw));
});
test('prompt carries the real rendering contract and treats a requested story as data',()=>{
 const a=videoPrompt('Una historia de descubrimiento entre la mente y el cielo'),b=videoPrompt('Una pieza musical que termina en una pausa junto a Lía');assert.notEqual(a,b);assert.match(a,/wide, medium o detail/);assert.match(a,/entre 4 y 16/);assert.match(a,/no una afirmación/);assert.match(a,/mind/);assert.throws(()=>videoPrompt('x'));assert.throws(()=>videoPrompt('x'.repeat(4001)));
});
