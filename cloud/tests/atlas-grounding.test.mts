import test from 'node:test';
import assert from 'node:assert/strict';
import {groundReflection,reflectionContext} from '../lib/research/grounding.ts';
import {initialWorld,selectWorldActor,worldPerspective} from '../lib/evolution/world.ts';
test('a conclusion without linked claims is preserved as hypothesis and cannot enter factual memory',()=>{
 const raw={conclusion:'Una afirmación general no respaldada.',claims:[],uncertainties:['Duda']},result=groundReflection(raw,['source-a']);
 assert.equal(result.grounding,'unverified');assert.equal(result.unverifiedHypothesis,raw.conclusion);assert.notEqual(result.conclusion,raw.conclusion);assert.equal(raw.conclusion,'Una afirmación general no respaldada.');
 const context=reflectionContext(raw);assert.doesNotMatch(JSON.stringify(context),/Una afirmación general/);
});
test('room planners do not reuse old unsupported world conclusions as factual context',()=>{
 const world=initialWorld(),actor=selectWorldActor(world,'programming'),memory=world.memories[actor.id];memory.conclusion='Una hipótesis histórica';
 assert.equal(worldPerspective(world,actor).previousConclusion,undefined);
 memory.grounding='unverified';assert.equal(worldPerspective(world,actor).previousConclusion,undefined);
 memory.grounding='source-linked';assert.equal(worldPerspective(world,actor).previousConclusion,memory.conclusion);
});
test('unknown or empty references are rejected and known references remain qualified hypotheses',()=>{
 const raw={conclusion:'Conclusión',claims:[{text:'Afirmación',sourceIds:['a']}],uncertainties:['Duda']};
 assert.throws(()=>groundReflection(raw,['b']),/INVALID_CITATION/);
 assert.throws(()=>groundReflection({...raw,claims:[{text:'Afirmación',sourceIds:[]}]},['a']),/INVALID_CITATION/);
 assert.equal(groundReflection(raw,['a']).grounding,'source-linked');
});

test('historical claims alone cannot restore an explicitly unverified conclusion to model context',()=>{
 const raw={grounding:'unverified' as const,conclusion:'HIPOTESIS_NO_VERIFICADA',claims:[{text:'AFIRMACION_NO_VERIFICADA',sourceIds:['old-source']}],uncertainties:['Conservar esta duda']};
 const before=structuredClone(raw),context=reflectionContext(raw);
 assert.doesNotMatch(JSON.stringify(context),/HIPOTESIS_NO_VERIFICADA|AFIRMACION_NO_VERIFICADA/);assert.deepEqual(context?.uncertainties,raw.uncertainties);assert.deepEqual(raw,before);
});
test('legacy citation strings require explicit grounding; source-linked context retains its limitation',()=>{
 const raw={conclusion:'Conclusión provisional',claims:[{text:'Afirmación',sourceIds:['a']}],uncertainties:['Duda']};
 assert.doesNotMatch(JSON.stringify(reflectionContext(raw)),/Conclusión provisional/);
 const linked=reflectionContext(groundReflection(raw,['a']));assert.equal(linked?.conclusion,raw.conclusion);assert.deepEqual(linked?.claims,raw.claims);assert.match(JSON.stringify(linked),/no demuestra|no prueba/);
});
