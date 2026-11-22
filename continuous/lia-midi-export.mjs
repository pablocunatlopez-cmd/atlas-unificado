/** Pure MIDI Standard MIDI File (format 1) export, no synthesis or I/O. */
const vlq=n=>{if(!Number.isSafeInteger(n)||n<0||n>0x0fffffff)throw new RangeError('Invalid MIDI delta');const b=[n&127];while((n>>>=7)>0)b.unshift((n&127)|128);return b};
const chunk=(name,bytes)=>[...Buffer.from(name,'ascii'),...u32(bytes.length),...bytes];
const u16=n=>[(n>>>8)&255,n&255],u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
export function exportLiaMidi(arrangement,{ticksPerBeat=480}={}){
 if(!arrangement||arrangement.schema!=='lia-music-arrangement-v1'||!Array.isArray(arrangement.tracks)||
  !Number.isInteger(ticksPerBeat)||ticksPerBeat<24||ticksPerBeat>9600||
  !Number.isFinite(arrangement.bpm)||arrangement.bpm<30||arrangement.bpm>300)
  throw new TypeError('Invalid MIDI export input');
 const tempo=Math.round(60000000/arrangement.bpm);
 const tempoTrack=chunk('MTrk',[0,255,81,3,(tempo>>>16)&255,(tempo>>>8)&255,tempo&255,0,255,47,0]);
 const tracks=arrangement.tracks.map((track,i)=>{
  if(i>=15||!Number.isInteger(track.program)||track.program<0||track.program>127||!Array.isArray(track.notes)||track.notes.length>10000)
   throw new TypeError('Invalid MIDI track');
  const channel=i>=9?i+1:i;
  const events=[{tick:0,order:0,bytes:[0xC0|channel,track.program]}];
  for(const n of track.notes){
   if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isInteger(n.velocity)||n.velocity<1||n.velocity>127||
    !Number.isFinite(n.startBeat)||n.startBeat<0||!Number.isFinite(n.durationBeats)||n.durationBeats<=0)
    throw new TypeError('Invalid MIDI note');
   const start=Math.round(n.startBeat*ticksPerBeat),end=Math.round((n.startBeat+n.durationBeats)*ticksPerBeat);
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end>0x0fffffff)
    throw new RangeError('MIDI note exceeds supported timeline');
   events.push({tick:start,order:2,bytes:[0x90|channel,n.pitch,n.velocity]},
    {tick:end,order:1,bytes:[0x80|channel,n.pitch,0]});
  }
  events.sort((a,b)=>a.tick-b.tick||a.order-b.order);
  let prev=0;const body=[];
  for(const e of events){body.push(...vlq(e.tick-prev),...e.bytes);prev=e.tick}
  body.push(0,255,47,0);
  return chunk('MTrk',body);
 });
 return Buffer.from(chunk('MThd',[...u16(1),...u16(tracks.length+1),...u16(ticksPerBeat)])
  .concat(tempoTrack,...tracks));
}
