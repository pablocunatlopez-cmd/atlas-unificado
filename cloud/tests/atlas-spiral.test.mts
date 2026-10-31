import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialLearning,runLearningCycle,learningSchema} from '../lib/atlas-spiral.ts';
const doc={id:'memo-1',title:'Límite de un procedimiento',text:'Este informe es una observación documental que aún no demuestra aprendizaje general. La memoria debe conservar las limitaciones y la fuente original.',kind:'Archivo histórico',date:'2026-10-17',url:'#spiral'};
test('a real cycle records the six phases, sources and local observations',async()=>{
 const result=await runLearningCycle(initialLearning(),[doc]);assert.equal(result.changed,true);assert.equal(result.cycle?.number,1);assert.equal(result.cycle?.phases.length,6);assert.equal(result.learning.sources.length,1);assert.ok(result.learning.observations.length>0);assert.ok(learningSchema.safeParse(result.learning).success);assert.equal(result.learning.cycles[0].novelty.resolvedPredictions,0);
});
test('same source or renamed duplicate cannot inflate learning',async()=>{
 const sameBatch=await runLearningCycle(initialLearning(),[doc,{...doc,id:'duplicate-in-same-batch'}]);assert.equal(sameBatch.learning.sources.length,1);
 const first=await runLearningCycle(initialLearning(),[doc]);const second=await runLearningCycle(first.learning,[doc]);assert.equal(second.changed,false);assert.equal(second.learning.cycles.length,1);assert.equal(second.learning.lastCheck?.result,'Sin novedad');
 const third=await runLearningCycle(second.learning,[{...doc,id:'renamed-copy',title:'Otra etiqueta'}]);assert.equal(third.changed,false);assert.equal(third.learning.cycles.length,1);
});
test('revised sources keep their earlier versions and cycle history',async()=>{
 const first=await runLearningCycle(initialLearning(),[doc]);const old=structuredClone(first.learning.cycles[0]);
 const next=await runLearningCycle(first.learning,[{...doc,text:doc.text+' Una evidencia posterior corrige el alcance y requiere una comparación adicional.'}]);
 assert.equal(next.learning.sources.length,2);assert.equal(next.learning.sources[0].id,next.learning.sources[1].id);assert.notEqual(next.learning.sources[0].hash,next.learning.sources[1].hash);assert.deepEqual(next.learning.cycles[0],old);assert.equal(next.learning.cycles[1].number,2);
});
test('finite corpus reaches no novelty and stops without a fake research conclusion',async()=>{
 const docs=Array.from({length:9},(_,i)=>({...doc,id:'unique-'+i,text:doc.text+' Observación nueva con identidad '+i+'.'}));let learning=initialLearning(),rounds=0;
 for(let i=0;i<10;i++){const result=await runLearningCycle(learning,docs);learning=result.learning;if(!result.changed)break;rounds++;}
 assert.equal(rounds,3);assert.equal(learning.sources.length,9);assert.equal(learning.cycles.length,3);assert.match(learning.cycles[0].progress.scientific,/Ningún descubrimiento/);assert.equal(learning.lastCheck?.result,'Sin novedad');
});
test('new method evaluation adds evidence once; repeated checks keep the earlier record',async()=>{
 const first=await runLearningCycle(initialLearning(),[]);assert.equal(first.cycle?.checks.length,7);
 const repeated=await runLearningCycle(first.learning,[]);assert.equal(repeated.changed,false);
 const changed=await runLearningCycle(repeated.learning,[],{version:'atlas-spiral-test-2'});assert.equal(changed.changed,true);assert.equal(changed.learning.cycles.length,2);
});
test('historical Q continuity is preserved as a dated snapshot, separate from C',async()=>{
 const continuity=JSON.parse(readFileSync(new URL('../data/continuity.json',import.meta.url),'utf8'));
 assert.equal(continuity.lastCompleted,593);assert.equal(continuity.openQuestion,594);assert.equal(continuity.target,1000);assert.equal(continuity.lastRecoveredAt,'2026-10-17');assert.match(continuity.conversationUrl,/6acc3757-6920-83ed-948e-7ea0a7c08722$/);
 const first=await runLearningCycle(initialLearning(),[doc]);assert.equal(first.cycle?.number,1);assert.match(first.learning.negativeMemory.join(' '),/no modifica.*Q/);
});
