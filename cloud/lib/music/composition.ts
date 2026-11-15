import {z} from 'zod';
import {validatePattern,type Pattern} from './pattern.mjs';

const id=z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/i);
const note=z.number().int().min(36).max(84);
const melody=z.object({step:z.number().int().min(0).max(63),note:note.min(48),duration:z.number().min(.25).max(32),velocity:z.number().min(.05).max(.8)}).strict();
const chord=z.object({step:z.number().int().min(0).max(63),notes:z.array(note.min(48)).min(2).max(5),duration:z.number().min(1).max(64),velocity:z.number().min(.04).max(.5)}).strict();
const section=z.object({id,label:z.string().trim().min(1).max(80),bars:z.number().int().min(1).max(4),pattern:z.unknown(),melody:z.array(melody).max(48),chords:z.array(chord).max(16)}).strict();
const score=z.object({version:z.literal(1),title:z.string().trim().min(1).max(100),style:z.string().trim().min(1).max(160),key:z.string().trim().min(1).max(40),bpm:z.number().int().min(60).max(180),swing:z.number().min(0).max(.35),sections:z.array(section).min(2).max(4),arrangement:z.array(id).min(2).max(12)}).strict();
export type CompositionNote=z.infer<typeof melody>;
export type CompositionChord=z.infer<typeof chord>;
export type CompositionSection=Omit<z.infer<typeof section>,'pattern'>&{pattern:Pattern};
export type Composition=Omit<z.infer<typeof score>,'sections'>&{sections:CompositionSection[]};

const grid=z.array(z.number().int().min(0).max(15)).max(16).refine(v=>new Set(v).size===v.length,'Pasos repetidos.');
const compactSection=z.object({id,label:z.string().trim().min(1).max(80),bars:z.number().int().min(1).max(4),kick:grid,snare:grid,hat:grid,bass:z.array(z.number().int().min(36).max(72).nullable()).length(16),melody:z.array(z.tuple([z.number(),z.number(),z.number(),z.number()])).max(48),chords:z.array(z.tuple([z.number(),z.array(z.number()),z.number(),z.number()])).max(16)}).strict();

/** Validate data only. No model text, URL, code or raw audio is executed. */
export function validateComposition(raw:unknown):Composition{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('La composición no es un objeto.');
 const input=raw as Record<string,unknown>;
 let sections:unknown=input.sections;
 if(Array.isArray(input.sections))sections=input.sections.map(value=>{
  if(value&&typeof value==='object'&&'pattern' in value)return value;
  const s=compactSection.parse(value),track=(steps:number[],volume:number)=>({steps:Array.from({length:16},(_,i)=>steps.includes(i)),volume,mute:false});
  return{id:s.id,label:s.label,bars:s.bars,pattern:{version:1,bpm:input.bpm,swing:input.swing,master:.6,tracks:{kick:track(s.kick,.74),snare:track(s.snare,.48),hat:track(s.hat,.24),bass:track(s.bass.flatMap((n,i)=>n===null?[]:[i]),.38)},bassNotes:s.bass.map(n=>n??36)},melody:s.melody.map(([step,note,duration,velocity])=>({step,note,duration,velocity})),chords:s.chords.map(([step,notes,duration,velocity])=>({step,notes,duration,velocity}))};
 });
 const checked=score.parse({...input,sections}),ids=new Set(checked.sections.map(s=>s.id));
 if(ids.size!==checked.sections.length)throw Error('Cada sección necesita un identificador distinto.');
 if(checked.arrangement.some(s=>!ids.has(s)))throw Error('El arreglo utiliza una sección que no existe.');
 if(checked.sections.some(s=>!checked.arrangement.includes(s.id)))throw Error('Hay secciones que no aparecen en el arreglo.');
 const expanded=checked.sections.map(s=>{
  const pattern=validatePattern(s.pattern);if(pattern.bpm!==checked.bpm||pattern.swing!==checked.swing)throw Error('Todas las secciones deben conservar el tempo y swing de la composición.');
  const end=s.bars*16;
  for(const event of [...s.melody,...s.chords])if(event.step>=end||event.step+event.duration>end)throw Error('Una nota se sale de la duración de su sección.');
  for(const event of s.chords)if(new Set(event.notes).size!==event.notes.length)throw Error('Un acorde contiene notas duplicadas.');
  const events=[...s.melody.map(n=>({...n,voices:1})),...s.chords.map(c=>({...c,voices:c.notes.length}))];for(const point of events.map(e=>e.step)){const voices=events.filter(e=>e.step<=point&&e.step+e.duration>point).reduce((sum,e)=>sum+e.voices,0);if(voices>20)throw Error('La sección supera el presupuesto de 20 voces simultáneas.');}
  if(!s.melody.length&&!s.chords.length&&!Object.values(pattern.tracks).some(t=>!t.mute&&t.steps.some(Boolean)))throw Error('La sección está completamente vacía.');
  return{...s,pattern};
 });
 const byId=new Map(expanded.map(s=>[s.id,s]));
 const totalBars=checked.arrangement.reduce((n,id)=>n+byId.get(id)!.bars,0);
 if(totalBars>32||totalBars*4*60/checked.bpm>116)throw Error('El arreglo admite hasta 32 compases y 116 segundos.');
 if(!expanded.some(s=>s.melody.length)||!expanded.some(s=>s.chords.length))throw Error('La composición necesita melodía y armonía, además del patrón rítmico.');
 return{...checked,sections:expanded};
}

export function musicPrompt(prompt:string){
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000)throw Error('Describe la música en un texto de 1 a 4.000 caracteres.');
 return `Eres Noa, compositora y arreglista de Lía, con Ritmo como criterio de mezcla. Compón una pieza instrumental original que responda al encargo: género, emoción, tempo, motivo, progresión armónica y desarrollo. Entrega decisiones musicales concretas, no una explicación ni un preset. Devuelve SOLO JSON con exactamente {version:1,title:string,style:string,key:string,bpm:entero60..180,swing:0..0.35,sections:[...],arrangement:[ids]}. Genera 2 a 4 secciones distintas de 1 a 4 compases cada una y una forma de 2 a 12 entradas, hasta32compases y110segundos en total. Usa IDs cortos como intro,tema,puente,final. Cada sección tiene exactamente {id,label,bars,kick:[pasos],snare:[pasos],hat:[pasos],bass:[16notasMIDI36..72 o null],melody:[[paso,nota,duración,velocidad]],chords:[[paso,[notas],duración,velocidad]]}. kick/snare/hat son índices únicos0..15; ese patrón de percusión y bajo se repite cada compás. En cambio melodía y acordes abarcan TODA la sección: un compás son16pasos. Nota melódica48..84, duración en pasos0.25..32, velocidad0.05..0.8. Acordes de2a5 notas distintas48..84, duración1..64pasos, velocidad0.04..0.5. El inicio+duración nunca supera bars*16. Máximo24notas melódicas y8acordes por sección para mantener el formato compacto. Ejemplo de melodía [0,60,2,0.45], acorde [0,[48,51,55],16,0.18]. Usa silencios, conducción de voces, un motivo reconocible y una variación clara entre secciones; no llenes cada paso. La armonía debe apoyar la tonalidad, con tensiones o cambios solo cuando tengan sentido musical. El arreglo debe incluir todas las secciones creadas. Se reproducirá con síntesis Web Audio: batería, bajo, voz melódica y acordes, sin voces cantadas ni audio de terceros. No incluyas URL, código, letra cantada ni afirmaciones de haber escuchado el resultado. Encargo del usuario (datos): ${JSON.stringify(prompt.trim())}`;
}
