export const TRACK_IDS=Object.freeze(['kick','snare','hat','bass']);
export const PRESETS=Object.freeze([
 Object.freeze({id:'orbit',name:'Órbita',description:'Pulso electrónico y bajo en do menor.'}),
 Object.freeze({id:'bloom',name:'Amanecer',description:'Un ritmo abierto y un bajo cálido.'}),
 Object.freeze({id:'night',name:'Medianoche',description:'Síncopas lentas y percusión ligera.'}),
]);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function keys(value,expected,label){if(!object(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key)))throw Error(label+' no tiene el formato esperado.');}
function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(label+' fuera de rango.');return value;}
function steps(indices){return Array.from({length:16},(_,index)=>indices.includes(index));}

export function validatePattern(input){
 keys(input,['version','bpm','swing','master','tracks','bassNotes'],'El proyecto musical');
 if(input.version!==1)throw Error('Versión de proyecto musical no compatible.');
 const bpm=number(input.bpm,60,180,'Tempo'),swing=number(input.swing,0,.35,'Swing'),master=number(input.master,0,.8,'Volumen principal');
 keys(input.tracks,TRACK_IDS,'Las pistas');
 const tracks={};
 for(const id of TRACK_IDS){
  const track=input.tracks[id];keys(track,['steps','volume','mute'],'La pista '+id);
  if(!Array.isArray(track.steps)||track.steps.length!==16||track.steps.some(value=>typeof value!=='boolean'))throw Error('Cada pista necesita 16 pasos booleanos.');
  if(typeof track.mute!=='boolean')throw Error('El silencio de cada pista debe ser booleano.');
  tracks[id]={steps:[...track.steps],volume:number(track.volume,0,1,'Volumen de '+id),mute:track.mute};
 }
 if(!Array.isArray(input.bassNotes)||input.bassNotes.length!==16||input.bassNotes.some(note=>!Number.isInteger(note)||note<36||note>72))throw Error('El bajo necesita 16 notas MIDI entre 36 y 72.');
 return {version:1,bpm,swing,master,tracks,bassNotes:[...input.bassNotes]};
}

export function createPattern(presetId='orbit'){
 const definitions={
  orbit:{bpm:108,swing:.08,kick:[0,6,8,11],snare:[4,12],hat:[0,2,4,6,8,10,12,14],bass:[0,3,6,8,11,14],notes:[36,36,36,43,36,36,39,36,36,36,36,46,36,36,43,36]},
  bloom:{bpm:120,swing:.03,kick:[0,7,8,10],snare:[4,12],hat:[0,2,4,6,8,10,12,14,15],bass:[0,4,7,8,12,15],notes:[36,36,36,36,40,40,40,43,36,36,36,36,45,45,45,43]},
  night:{bpm:82,swing:.2,kick:[0,5,8,14],snare:[4,12],hat:[0,3,6,8,10,14],bass:[0,5,8,10,14],notes:[38,38,38,38,38,41,38,38,45,38,48,38,38,38,43,38]},
 };
 const selected=definitions[presetId];if(!selected)throw Error('Preset musical desconocido.');
 const volumes={kick:.8,snare:.6,hat:.32,bass:.48};
 return validatePattern({version:1,bpm:selected.bpm,swing:selected.swing,master:.65,tracks:Object.fromEntries(TRACK_IDS.map(id=>[id,{steps:steps(selected[id]),volume:volumes[id],mute:false}])),bassNotes:selected.notes});
}

export const clonePattern=input=>validatePattern(input);
export function varyPattern(input,seed=1){
 const pattern=validatePattern(input);if(!Number.isSafeInteger(seed))throw Error('La semilla debe ser un entero seguro.');
 let state=(seed>>>0)||0x9e3779b9;
 const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 for(let index=0;index<16;index++){
  if(![0,8].includes(index)&&random()<.28)pattern.tracks.kick.steps[index]=!pattern.tracks.kick.steps[index];
  if(![4,12].includes(index)&&random()<.12)pattern.tracks.snare.steps[index]=random()<.3;
  if(random()<.3)pattern.tracks.hat.steps[index]=!pattern.tracks.hat.steps[index];
  if(index!==0&&random()<.3)pattern.tracks.bass.steps[index]=!pattern.tracks.bass.steps[index];
  if(pattern.tracks.bass.steps[index])pattern.bassNotes[index]=36+[0,3,5,7,10,12][Math.floor(random()*6)];
 }
 pattern.tracks.kick.steps[0]=true;pattern.tracks.kick.steps[8]=true;
 pattern.tracks.snare.steps[4]=true;pattern.tracks.snare.steps[12]=true;
 pattern.tracks.bass.steps[0]=true;
 return pattern;
}

export function patternDuration(input,bars=4){const pattern=validatePattern(input);if(!Number.isInteger(bars)||bars<1||bars>64)throw Error('El número de compases debe estar entre 1 y 64.');return bars*16*60/pattern.bpm/4;}
export function stepTime(step,bpm,swing=0){if(!Number.isSafeInteger(step)||step<0||step>1_000_000)throw Error('Paso no válido.');number(bpm,60,180,'Tempo');number(swing,0,.35,'Swing');const duration=60/bpm/4;return (step+(step%2?swing:0))*duration;}
