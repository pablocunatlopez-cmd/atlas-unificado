/** Encode interleaved signed PCM16 WAVE; no browser or media API is required. */
export function encodeWav(channels,sampleRate){
 if(!Array.isArray(channels)||channels.length<1||channels.length>2||channels.some(channel=>!(channel instanceof Float32Array)))throw Error('WAV admite uno o dos canales Float32Array.');
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>96000)throw Error('Frecuencia de muestreo no válida.');
 const frames=channels[0].length;
 if(!frames||channels.some(channel=>channel.length!==frames)||frames>sampleRate*300)throw Error('Los canales deben tener igual longitud y una duración de hasta cinco minutos.');
 const channelCount=channels.length,dataBytes=frames*channelCount*2,buffer=new ArrayBuffer(44+dataBytes),view=new DataView(buffer);
 const text=(offset,value)=>{for(let index=0;index<value.length;index++)view.setUint8(offset+index,value.charCodeAt(index));};
 text(0,'RIFF');view.setUint32(4,36+dataBytes,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channelCount,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channelCount*2,true);view.setUint16(32,channelCount*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,dataBytes,true);
 let offset=44;
 for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channelCount;channel++){
  const raw=channels[channel][frame],sample=Number.isFinite(raw)?Math.max(-1,Math.min(1,raw)):0;
  view.setInt16(offset,Math.round(sample*(sample<0?32768:32767)),true);offset+=2;
 }
 return buffer;
}
