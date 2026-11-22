/** Minimal deterministic PCM WAV synthesis of editable note arrangements.
 * Synthesizes sine tones only, no sampled instruments or vocals.
 */
export function renderLiaArrangementWav(arrangement,{sampleRate=22050,maxSeconds=30}={}){
 if(!arrangement||arrangement.schema!=='lia-music-arrangement-v1'||!Array.isArray(arrangement.tracks)||
  !Number.isFinite(arrangement.bpm)||arrangement.bpm<=0||
  !Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>48000||
  !Number.isFinite(maxSeconds)||maxSeconds<=0||maxSeconds>120)
  throw new TypeError('Invalid WAV render request');
 const notes=arrangement.tracks.flatMap(t=>t.notes);
 if(notes.length>10000)throw new RangeError('Too many notes');
 let end=0;
 for(const n of notes){
  if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isFinite(n.startBeat)||
   n.startBeat<0||!Number.isFinite(n.durationBeats)||n.durationBeats<=0||
   !Number.isInteger(n.velocity)||n.velocity<1||n.velocity>127)
   throw new TypeError('Invalid note');
  end=Math.max(end,(n.startBeat+n.durationBeats)*60/arrangement.bpm);
 }
 if(end>maxSeconds)throw new RangeError('Audio exceeds render limit');
 const count=Math.max(1,Math.ceil(end*sampleRate)),samples=new Float32Array(count);
 for(const n of notes){
  const start=Math.round(n.startBeat*60/arrangement.bpm*sampleRate);
  const length=Math.max(1,Math.round(n.durationBeats*60/arrangement.bpm*sampleRate));
  const freq=440*Math.pow(2,(n.pitch-69)/12),amp=(n.velocity/127)*.18;
  for(let j=0;j<length&&start+j<count;j++){
   const env=Math.min(1,j/Math.max(1,sampleRate*.01), (length-j)/Math.max(1,sampleRate*.03));
   samples[start+j]+=Math.sin(2*Math.PI*freq*j/sampleRate)*amp*Math.max(0,env);
  }
 }
 const out=Buffer.alloc(44+count*2);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);
 out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
 out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);
 out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);
 out.write('data',36);out.writeUInt32LE(count*2,40);
 for(let i=0;i<count;i++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
 return out;
}
