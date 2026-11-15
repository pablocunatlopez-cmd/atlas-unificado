import test from 'node:test';
import assert from 'node:assert/strict';
import {validateComposition,musicPrompt} from '../lib/music/composition.ts';
import {compositionTimeline,compositionDuration,scheduleComposition} from '../lib/music/composition-audio.ts';
import {buildMixer} from '../lib/music/audio.ts';
const section=(id:string,note=60)=>({id,label:id,bars:2,kick:[0,8],snare:[4,12],hat:[2,6,10,14],bass:[48,null,null,null,55,null,null,null,48,null,null,null,55,null,null,null],melody:[[0,note,2,.4],[8,note+7,4,.4],[20,note+3,4,.35]],chords:[[0,[48,51,55],16,.18],[16,[53,56,60],16,.18]]});
const score=()=>({version:1,title:'Motivo de Lía',style:'Electrónica cálida',key:'Do menor',bpm:120,swing:.1,sections:[section('tema'),section('puente',62)],arrangement:['tema','puente','tema']});

test('model-authored compact notes, chords, rhythm and arrangement survive validation',()=>{
 const raw=score(),before=structuredClone(raw),value=validateComposition(raw);
 assert.deepEqual(raw,before);assert.deepEqual(value.sections[0].melody[0],{step:0,note:60,duration:2,velocity:.4});assert.deepEqual(value.sections[1].melody.map(n=>n.note),[62,69,65]);assert.deepEqual(value.sections[0].chords[1].notes,[53,56,60]);assert.deepEqual(value.sections[0].pattern.tracks.kick.steps.map((v,i)=>v?i:null).filter(v=>v!==null),[0,8]);assert.deepEqual(value.arrangement,['tema','puente','tema']);assert.deepEqual(validateComposition(value),value);
 value.sections[0].melody[0].note=80;assert.equal(raw.sections[0].melody[0][1],60);
});
test('arrangement timeline repeats authored sections in order, including every bar',()=>{
 const value=validateComposition(score()),timeline=compositionTimeline(value);assert.deepEqual(timeline.map(t=>[t.sectionId,t.startSeconds,t.durationSeconds]),[['tema',0,4],['puente',4,4],['tema',8,4]]);assert.equal(compositionDuration(value),12);
});
test('malformed or unbounded musical scores are rejected before audio scheduling',()=>{
 const mutations=[{arrangement:['tema','unknown']},{sections:[section('tema'),section('tema')]},{sections:[{...section('tema'),melody:[[31,60,2,.4]]},section('puente')]},{sections:[{...section('tema'),melody:[[0,150,2,.4]]},section('puente')]},{sections:[{...section('tema'),chords:[[0,[48,48,55],16,.2]]},section('puente')]},{sections:[{...section('tema'),kick:[0,0]},section('puente')]},{sections:[{...section('tema'),melody:[],chords:[]}, {...section('puente'),melody:[],chords:[]}]},{arrangement:['tema','tema']},{bpm:60,sections:[{...section('tema'),bars:4},{...section('puente'),bars:4}],arrangement:Array.from({length:8},(_,i)=>i%2?'puente':'tema')},{sections:[{...section('tema'),melody:Array.from({length:21},()=>[0,60,8,.4])},section('puente')]},{code:'eval(secret)'}];
 for(const mutation of mutations)assert.throws(()=>validateComposition({...score(),...mutation}),JSON.stringify(mutation));
 const canonical=validateComposition(score());canonical.sections[0].pattern.bpm=121;assert.throws(()=>validateComposition(canonical),/tempo/);
});
test('actual audio scheduler receives distinct generated pitches, chords and section boundaries',()=>{
 const oscillators:{frequency:{value:number};type:string;startTime?:number;stopTime?:number}[]=[];
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 const node=()=>({connect(){},disconnect(){},gain:param(),frequency:param(),Q:param()});
 const context={currentTime:0,sampleRate:8000,destination:node(),createGain:node,createBiquadFilter:node,createDynamicsCompressor:()=>({...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()}),createBuffer:()=>({getChannelData:()=>new Float32Array(8000)}),createBufferSource:()=>({...node(),start(){},stop(){}}),createOscillator:()=>{const osc={...node(),type:'',startTime:undefined as number|undefined,stopTime:undefined as number|undefined,start(at:number){this.startTime=at;},stop(at:number){this.stopTime=at;}};oscillators.push(osc);return osc;}} as unknown as BaseAudioContext;
 const value=validateComposition(score()),mixer=buildMixer(context,value.sections[0].pattern),result=scheduleComposition(mixer,value,.2),hz=(n:number)=>440*2**((n-69)/12);
 assert.equal(result.endTime,13.2);assert.ok(oscillators.some(o=>o.type==='triangle'&&Math.abs(o.frequency.value-hz(60))<1e-8&&o.startTime===.2));assert.ok(oscillators.some(o=>o.type==='triangle'&&Math.abs(o.frequency.value-hz(62))<1e-8&&o.startTime===4.2));assert.ok(oscillators.some(o=>o.type==='sine'&&Math.abs(o.frequency.value-hz(51))<1e-8&&o.startTime===.2));assert.throws(()=>scheduleComposition(mixer,value,-1),/Inicio/);assert.ok(mixer.sources.size>100);
});
test('composer prompt requests actual musical decisions and treats the brief as data',()=>{const prompt=musicPrompt('Jazz irregular, tema oscuro');assert.match(prompt,/Jazz irregular/);assert.match(prompt,/melody/);assert.match(prompt,/chords/);assert.match(prompt,/conducción de voces/);assert.match(prompt,/datos/);assert.throws(()=>musicPrompt(''));assert.throws(()=>musicPrompt('a'.repeat(4001)));});
test('musical guidance develops complete phrases and harmonic coverage while respecting genre and intentional space',()=>{
 const prompt=musicPrompt('Jazz nocturno en dos secciones, tema-puente-tema');
 for(const criterion of [/frases con dirección/,/a lo largo de toda la sección/,/armonía cubra cada compás/,/séptimas y novenas/,/tensiones preparadas o resueltas/,/cromatismo debe tener función/,/decisiones audibles/,/velocidades que modelen una dinámica/,/reutiliza el ID del tema/])assert.match(prompt,criterion);
 assert.match(prompt,/adapta esa densidad al encargo, sin convertirla en cuota/);assert.match(prompt,/ambient.*pueden funcionar muchas menos notas/);assert.match(prompt,/silencios deliberados/);assert.match(prompt,/no son objetivos de densidad/);
 // Sparse material remains valid: artistic guidance is not an invented density gate.
 assert.equal(validateComposition(score()).sections[0].melody.length,3);
});
