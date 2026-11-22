/** Lía music arrangement schema: editable note events, not audio synthesis. */
const safeId=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(s);
export function compileLiaArrangement({id,title,bpm=120,tracks=[]}={}){
 if(!safeId(id)||typeof title!=='string'||!title.trim()||title.length>120||
  !Number.isFinite(bpm)||bpm<30||bpm>300||!Array.isArray(tracks)||tracks.length>64)
  throw new TypeError('Invalid Lía arrangement');
 const ids=new Set(),out=tracks.map(t=>{
  if(!t||!safeId(t.id)||ids.has(t.id)||!Number.isInteger(t.program)||
   t.program<0||t.program>127||!Array.isArray(t.notes)||t.notes.length>10000)
   throw new TypeError('Invalid track');
  ids.add(t.id);
  const notes=t.notes.map(n=>{
   if(!n||!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||
    !Number.isFinite(n.startBeat)||n.startBeat<0||n.startBeat>100000||
    !Number.isFinite(n.durationBeats)||n.durationBeats<=0||n.durationBeats>10000||
    !Number.isInteger(n.velocity)||n.velocity<1||n.velocity>127)
    throw new TypeError('Invalid MIDI note');
   return Object.freeze({pitch:n.pitch,startBeat:n.startBeat,
    durationBeats:n.durationBeats,velocity:n.velocity});
  });
  return Object.freeze({id:t.id,program:t.program,notes:Object.freeze(notes)});
 });
 return Object.freeze({schema:'lia-music-arrangement-v1',id,title:title.trim(),bpm,
  tracks:Object.freeze(out),editable:true,midiExportReady:false,wavRendered:false,
  compositionQualityVerified:false});
}
