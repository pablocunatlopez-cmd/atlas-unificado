import {z} from 'zod';
import type {Mission} from './missions.ts';
import {LIA_ARCHITECTURE} from '../core/identity.ts';
import {LOR_FIELDS,CORE_PHASES} from '../core/lor-spec.ts';
import {capabilityTests} from '../atlas-core.ts';
import {createPattern,varyPattern,validatePattern,patternDuration,stepTime} from '../music/pattern.mjs';
import {transposePattern} from '../music/transposition.mjs';
import {audioFeatures,masterChannels,imageFeatures} from '../evolution/signals.ts';
import {verifyProgramLibrary,runProgramTool} from '../cloud/program-tools.mjs';
import {ROOM_IDS} from '../../public/house/layout.js';
import {publicUrl} from '../research/web.ts';

export type HouseToolArtifact={kind:'music'|'audio'|'film'|'lor'|'conversation'|'image'|'program'|'research';value:any};
export type HouseToolResult={domain:string;status:'applied'|'tested'|'unchanged'|'waiting';title:string;summary:string;artifact?:HouseToolArtifact;checks:{name:string;passed:boolean}[];changed:boolean;needsEngineering?:boolean};
type Previous={kind:string;value:any};
const version='house-tools-1';
const check=(name:string,passed:boolean)=>({name,passed});
const seedFor=(id:string)=>{let seed=2166136261;for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619);return seed>>>0;};
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const identical=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function output(m:Mission,previous:Previous|undefined,result:Omit<HouseToolResult,'domain'|'changed'>):HouseToolResult{
 const same=!!result.artifact&&previous?.kind===result.artifact.kind&&identical(previous.value,result.artifact.value);
 if(same)return{...result,domain:m.domain,status:'unchanged',changed:false,summary:'El resultado coincide con el ya conservado. Se ha verificado sin contar una mejora nueva. '+result.summary};
 return{...result,domain:m.domain,changed:!!result.artifact&&result.checks.every(c=>c.passed)};
}
function waiting(m:Mission,summary:string):HouseToolResult{return{domain:m.domain,status:'waiting',title:m.title,summary,checks:[],changed:false,needsEngineering:true};}

function music(m:Mission,previous?:Previous):HouseToolResult{
 // Generate one stable, editable draft per owner. Its seed comes from identity,
 // never the clock or turn count; replaying a turn cannot manufacture novelty.
 if(previous?.kind==='music')validatePattern(previous.value);
 const seed=seedFor(m.id),preset=['orbit','bloom','night'][seed%3];
 const pattern=validatePattern(transposePattern(varyPattern(createPattern(preset),seed),2));
 const checks=[check('Patrón editable válido y con 16 pasos',pattern.bassNotes.length===16),check('Pulso y caja conservan anclas musicales',[0,8].every(i=>pattern.tracks.kick.steps[i])&&[4,12].every(i=>pattern.tracks.snare.steps[i])),check('Duración y secuenciación finitas',Number.isFinite(patternDuration(pattern,4))&&stepTime(1,pattern.bpm,pattern.swing)>stepTime(0,pattern.bpm,pattern.swing))];
 return output(m,previous,{status:'applied',title:'Borrador musical de '+m.name,summary:'Variación procedural reproducible y transpuesta, preparada para editar y escuchar. No se sobrescribe un proyecto del usuario ni se acredita mayor calidad musical sin escucha.',artifact:{kind:'music',value:pattern},checks});
}

function audio(m:Mission,previous?:Previous):HouseToolResult{
 const fixture=()=>{const left=Array.from({length:128},(_,i)=>.2+1.2*Math.sin(2*Math.PI*i/64));return[left,left.map(v=>v*.5)];};
 const value=previous?.kind==='audio'?previous.value:null;
 const source=value?.version===version&&Array.isArray(value.sourceChannels)?value.sourceChannels:value&&Array.isArray(value.channels)?value.channels:fixture();
 const sampleRate=value&&typeof value.sampleRate==='number'?value.sampleRate:16000;
 if(!Array.isArray(source)||!source.length||source.length>2||source.some((c:unknown)=>!Array.isArray(c)||!c.length||c.length>128||c.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v)))||source.some((c:number[])=>c.length!==source[0].length))throw Error('La señal debe tener uno o dos canales finitos de hasta 128 muestras.');
 const input=source.map((c:number[])=>Float32Array.from(c)),before=input.map((c:Float32Array)=>audioFeatures(c,sampleRate)),mastered=masterChannels(input),after=mastered.channels.map(c=>audioFeatures(c,sampleRate));
 const checks=[check('Pico acotado sin nuevas muestras recortadas',after.every((c,i)=>c.peak<=.94001&&c.clipped<=before[i].clipped)),check('DC eliminado y muestras finitas',after.every(c=>Math.abs(c.mean)<1e-6&&c.invalid===0)),check('Silencio preservado',masterChannels([new Float32Array(16)]).channels[0].every(v=>v===0))];
 return output(m,previous,{status:'applied',title:'Mezcla comprobada por '+m.name,summary:(value?'Se procesó la señal aportada. ':'Se procesó una señal sintética reproducible. ')+'Se midieron pico, DC y recorte antes y después. No acredita escucha, comprensión musical ni mejora de todo el sonido de Lía.',artifact:{kind:'audio',value:{version,sampleRate,sourceChannels:input.map((c:Float32Array)=>Array.from(c)),channels:mastered.channels.map(c=>Array.from(c)),before,after,gain:mastered.gain,removedDC:mastered.removedDC}},checks});
}

const shotSchema=z.object({room:z.string().refine(r=>ROOM_IDS.includes(r)),seconds:z.number().finite().positive().max(16),cue:z.string().trim().min(3).max(240)});
const filmSchema=z.object({version:z.literal(version),title:z.string().trim().min(3).max(160),rooms:z.array(z.string().refine(r=>ROOM_IDS.includes(r))).min(1).max(4),seconds:z.number().int().min(4).max(16),shots:z.array(shotSchema).min(1).max(4),captureRequired:z.literal(true)}).superRefine((v,c)=>{if(v.shots.length!==v.rooms.length||v.shots.some((s,i)=>s.room!==v.rooms[i]))c.addIssue({code:'custom',message:'Orden de planos incompatible con sus salas.'});if(Math.abs(v.shots.reduce((sum,s)=>sum+s.seconds,0)-v.seconds)>1e-6)c.addIssue({code:'custom',message:'La duración de los planos no coincide con el total.'});});
function film(m:Mission,previous?:Previous):HouseToolResult{
 const rooms=[...new Set([m.room,'salon','body','constellation'])].filter(r=>ROOM_IDS.includes(r)).slice(0,4);
 const draft=previous?.kind==='film'?filmSchema.parse(previous.value):filmSchema.parse({version,title:'Recorrido de '+m.name,rooms,seconds:12,shots:rooms.map(room=>({room,seconds:12/rooms.length,cue:room==='salon'?'Presentar a Lía en su entorno compartido.':room==='body'?'Mostrar herramientas y consecuencias de Ion.':room==='constellation'?'Conectar con Ícaro y sus referencias.':'Relacionar el oficio de esta sala con Lía.'})),captureRequired:true});
 const checks=[check('Salas y orden de planos válidos',draft.rooms.every((r,i)=>ROOM_IDS.includes(r)&&draft.shots[i].room===r)),check('Duración total comprobada',Math.abs(draft.shots.reduce((sum,s)=>sum+s.seconds,0)-draft.seconds)<1e-6)];
 return output(m,previous,{status:'applied',title:'Guion de cámara comprobado',summary:'Guion preparado para la cámara del navegador, con orden y duración comprobados. Todavía requiere captura y reproducción; no se ha generado ni observado un vídeo.',artifact:{kind:'film',value:draft},checks});
}

function lor(m:Mission,previous?:Previous):HouseToolResult{
 const fields=LOR_FIELDS.map(f=>({symbol:f.symbol,name:f.name})),phases=CORE_PHASES.map(p=>({id:p.id,name:p.name}));
 const report=capabilityTests();
 const value={version,owner:m.id,beneficiary:'lia',fields,phases,frame:{object:m.question,environment:m.room,perspective:m.name,scale:'Misión y resultado verificable'},semiosis:{object:'Encargo del oficio',sign:m.question,interpretant:'Propuesta por contrastar: '+m.application},assumptions:['El encargo no es evidencia de que la mejora esté aplicada.','Una estructura formal no demuestra por sí sola una teoría física.']};
 const checks=[check('Doce símbolos originales únicos',fields.length===12&&new Set(fields.map(f=>f.symbol)).size===12),check('Seis operaciones de la espiral conservadas',phases.length===6),...report.map(c=>check(c.name,c.passed))];
 return output(m,previous,{status:'applied',title:'Contrato LOR de '+m.name,summary:'Se estructuró el encargo con sus campos originales y se ejecutaron pruebas reales de aritmética, inferencia y contradicciones. No se ejecuta el antiguo experimento GPU ni se atribuye comprensión general al contrato.',artifact:{kind:'lor',value},checks});
}

function image(m:Mission,previous?:Previous):HouseToolResult{
 const rgba=new Uint8ClampedArray([255,255,255,255,0,0,0,255,128,128,128,255,255,255,255,0]),features=imageFeatures(rgba,2,2),expected=(1+0.21586050011389926)/3;
 const checks=[check('Transparencia excluida de la medida',features.visiblePixels===3),check('Luminancia sRGB lineal calibrada con referencia W3C',Math.abs(features.luminance-expected)<1e-6),check('Contraste y bordes finitos',Number.isFinite(features.contrast)&&features.contrast>0&&Number.isFinite(features.edgeEnergy))];
 return output(m,previous,{status:'tested',title:'Medición de imagen comprobada',summary:'Se ejecutó imageFeatures sobre cuatro píxeles sintéticos, incluida transparencia, con luminancia relativa sRGB lineal. El alfa no nulo se incluye sin ponderar ni componer sobre fondo. No se ha observado una imagen del juego ni se reconocen objetos o personajes.',artifact:{kind:'image',value:{version,fixture:{width:2,height:2,rgba:Array.from(rgba)},features}},checks,needsEngineering:true});
}

function program(m:Mission,previous?:Previous):HouseToolResult{
 const report=verifyProgramLibrary(),execution=runProgramTool('intervals',[[5,8],[1,3],[2,6]]),invalidRejected=(()=>{try{runProgramTool('intervals',[[3,1]]);return false;}catch{return true;}})();
 const checks=[...report.checks.map((c:{operation:string;name:string;passed:boolean})=>check(c.operation+': '+c.name,c.passed)),check('Intervalos ejecutados y unidos correctamente',identical(execution.result,[[1,8]])),check('Entrada inválida rechazada',invalidRejected)];
 return output(m,previous,{status:'tested',title:'Biblioteca ejecutada por '+m.name,summary:'Se ejecutaron cinco herramientas de datos y un caso concreto de fusión de intervalos. No se instaló código nuevo; repetir los mismos contratos no acredita una mejora.',artifact:{kind:'program',value:{version,library:report.version,passed:report.passed,total:report.total,execution:{operation:execution.operation,input:[[5,8],[1,3],[2,6]],result:execution.result},invalidRejected}},checks,needsEngineering:true});
}

const contextSchema=z.object({version:z.literal(version),owner:z.string().min(1),beneficiary:z.literal('lia'),question:z.string().min(5).max(1200),application:z.string().min(5).max(2000),requiredChecks:z.array(z.string().min(3).max(500)).min(1).max(16),references:z.array(z.object({url:z.string(),title:z.string().min(1),status:z.literal('candidate-not-read')})).max(8),architecture:z.literal(LIA_ARCHITECTURE.version)});
function context(m:Mission,previous?:Previous):HouseToolResult{
 const value=contextSchema.parse({version,owner:m.id,beneficiary:'lia',question:m.question,application:m.application,requiredChecks:[...m.validation],references:m.sources.slice(0,8).map(s=>({url:publicUrl(s.url),title:s.title,status:'candidate-not-read'})),architecture:LIA_ARCHITECTURE.version});
 const checks=[check('Beneficiaria y contexto validados',value.beneficiary==='lia'&&value.owner===m.id),check('Referencias candidatas HTTPS permitidas',value.references.every(r=>publicUrl(r.url)===r.url)),check('Fuentes no presentadas como ya leídas',value.references.every(r=>r.status==='candidate-not-read'))];
 const conversation=m.focus==='conversation'||m.domain==='conversation'||m.id==='room:salon';
 return output(m,previous,{status:'tested',title:conversation?'Contexto de Lía preparado':'Encargo trazable de '+m.name,summary:'Se validó un contrato de contexto y entrega para el oficio. Las referencias están pendientes de lectura. No se ha producido una respuesta de modelo ni una mejora semántica; el encargo sigue disponible para investigación e ingeniería.',artifact:{kind:conversation?'conversation':'research',value},checks,needsEngineering:true});
}

/** Actual bounded CPU work. No network, inference, source editing, clock-based
 * variation, autoplay, recording or personal project mutation occurs here. */
export function performHouseTool(mission:Mission,previous?:Previous):HouseToolResult{
 try{
  if(mission.targetProject!=='atlas')return waiting(mission,'La mejora pertenece al código de ERAS. Se conserva el encargo para inspección y pruebas del repositorio; no se transforma al personaje en otra herramienta.');
  if(mission.id==='process:weights')return waiting(mission,'El entrenamiento de pesos externos no está disponible en el Worker gratuito. El laboratorio requiere un trabajo de ingeniería o evaluación específico.');
  if(mission.domain==='image-features'||mission.id==='sense:image')return image(mission,previous);
  if(['mixing','listening-review','audio-features','module-audio'].includes(mission.domain)||mission.id==='sense:audio')return audio(mission,previous);
  if(mission.focus==='music')return music(mission,previous);
  if(mission.focus==='video')return film(mission,previous);
  if(mission.focus==='language')return lor(mission,previous);
  if(['software-tools','action-contracts','module-programming','process-tools','regression-testing','evaluation-control','experimentation'].includes(mission.domain)||mission.id==='room:body'||mission.id==='room:refutation')return program(mission,previous);
  if(mission.focus==='3d'||mission.focus==='games')return waiting(mission,'Este oficio necesita una intervención gráfica o de interacción. El coordinador puede ejecutar el laboratorio espacial apropiado; esta herramienta no inventa una reforma 3D.');
  return context(mission,previous);
 }catch(error){return{...waiting(mission,error instanceof Error?error.message:'La herramienta no pudo completar el contrato.'),checks:[check('Operación y entradas válidas',false)]};}
}
