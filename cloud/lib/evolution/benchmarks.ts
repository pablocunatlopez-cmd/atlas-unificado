import {sphereGeometry} from '../studio/gltf.ts';
import {calculateOperands} from '../studio/calculator.ts';
import {audioFeatures,masterChannels,imageFeatures} from './signals.ts';
export const BENCHMARK_VERSION='atlas-capabilities-1';
export type Capability='graphics'|'programming'|'audio'|'perception';
export type Profiles={meshRows:12|18|24;audioMastering:boolean};
export type Trial={version:string;branch:Capability;decision:'promoted'|'verified'|'rejected';before:number;after:number;metric:string;checks:{name:string;passed:boolean}[];scope:string;candidate:string;rollback:Profiles};
export const baselineProfiles=():Profiles=>({meshRows:12,audioMastering:false});
// Measures the inward radial error at triangle centroids of the actual exported mesh.
export function meshError(rows:number){const g=sphereGeometry(rows,rows*1.5);let error=0;for(let i=0;i<g.indices.length;i+=3){const p=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)p[k]+=g.position[g.indices[i+j]*3+k]/3;error=Math.max(error,1-Math.hypot(...p));}return{error,triangles:g.indices.length/3,finite:g.position.every(Number.isFinite)};}
export function runCapabilityTrial(branch:Capability,profiles:Profiles):{trial:Trial;profiles:Profiles}{
 const next={...profiles},checks:Trial['checks']=[];let before=0,after=0,metric='',candidate='',scope='',promote=false;
 if(branch==='graphics'){
  const rows=profiles.meshRows===12?18:24,base=meshError(profiles.meshRows),test=meshError(rows);before=base.error;after=test.error;metric='Error radial máximo en centroides (menor es mejor)';candidate=`sphere-${rows}x${rows*1.5}`;
  checks.push({name:'Vértices finitos y presupuesto de 2.000 triángulos por esfera',passed:test.finite&&test.triangles<=2000},{name:'Sin aumento del error geométrico',passed:after<=before+1e-10});promote=after<before-1e-7&&checks.every(c=>c.passed);if(promote)next.meshRows=rows;
  scope='Geometría de esfera en CPU. No mide FPS, calidad estética, personajes, iluminación ni fotorealismo. Solo afecta a nuevas creaciones.';
 }else if(branch==='audio'){
  const signal=Float32Array.from({length:4096},(_,i)=>.2+1.2*Math.sin(2*Math.PI*i/64)),stereo=[signal,Float32Array.from(signal,v=>v*.5)],output=masterChannels(stereo),base=audioFeatures(signal,16000),test=audioFeatures(output.channels[0],16000);before=profiles.audioMastering?test.clipped:base.clipped;after=test.clipped;metric='Muestras fuera de margen en señal sintética (menor es mejor)';candidate='dc-peak-stereo-v1';
  checks.push({name:'Pico máximo de 0,94 y DC cercano a cero',passed:test.peak<=.94001&&Math.abs(test.mean)<1e-6},{name:'Relación estéreo conservada',passed:output.channels[1].every((v,i)=>Math.abs(v-output.channels[0][i]*.5)<1e-6)},{name:'Silencio conservado',passed:masterChannels([new Float32Array(16)]).channels[0].every(v=>v===0)});promote=!profiles.audioMastering&&checks.every(c=>c.passed)&&after<before;if(promote)next.audioMastering=true;
  scope='DSP de exportación WAV: eliminación de DC y atenuación de picos. No juzga musicalidad, voz, comprensión auditiva ni calidad de un modelo de audio.';
 }else if(branch==='programming'){
  const cases:[string,string,string,string][]=[['7','5','+','12'],['7','5','-','2'],['7','5','*','35'],['7','5','/','1.4'],['1','0','/','No se puede dividir entre cero'],['','3','+','Introduce dos números'],['1','2','eval','Operación no válida'],['1e308','1e308','*','Resultado fuera de rango']];
  for(const [a,b,op,expected]of cases)checks.push({name:`Calculadora: ${a} ${op} ${b}`,passed:String(calculateOperands(a,b,op))===expected});before=after=checks.filter(c=>c.passed).length;metric='Contratos aritméticos superados';candidate='calculator-contracts-v1';scope='La misma función que emite el compilador de calculadoras. No ejecuta código arbitrario, no evalúa programación general ni sustituye pruebas en navegador.';
 }else{
  const silence=audioFeatures(new Float32Array(32),16000),white=imageFeatures(new Uint8ClampedArray([255,255,255,255]),1,1),transparent=imageFeatures(new Uint8ClampedArray([255,255,255,0]),1,1),bad=audioFeatures(new Float32Array([NaN,0]),16000);
  checks.push({name:'Silencio sin energía inventada',passed:silence.rms===0&&silence.dbfs===null},{name:'Luminancia blanca correcta',passed:Math.abs(white.luminance-1)<1e-6},{name:'Transparencia excluida',passed:transparent.visiblePixels===0},{name:'Datos no finitos detectados',passed:bad.invalid===1});before=after=checks.filter(c=>c.passed).length;metric='Contratos de señales superados';candidate='local-features-v1';scope='Medidas de píxeles y amplitud. No reconoce objetos, personas, emociones, habla ni significado.';
 }
 return{profiles:next,trial:{version:BENCHMARK_VERSION,branch,decision:checks.some(c=>!c.passed)?'rejected':promote?'promoted':'verified',before,after,metric,checks,scope,candidate,rollback:{...profiles}}};
}
