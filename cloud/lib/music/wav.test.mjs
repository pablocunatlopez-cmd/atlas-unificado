import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeWav} from './wav.mjs';
const ascii=(view,start,count)=>String.fromCharCode(...Array.from({length:count},(_,i)=>view.getUint8(start+i)));
test('WAV has correct PCM16 stereo header and interleaves exact sample frames',()=>{
 const view=new DataView(encodeWav([new Float32Array([-1,0,.5]),new Float32Array([1,.25,-.5])],48000));
 assert.equal(view.byteLength,56);assert.equal(ascii(view,0,4),'RIFF');assert.equal(ascii(view,8,4),'WAVE');assert.equal(ascii(view,12,4),'fmt ');assert.equal(ascii(view,36,4),'data');assert.equal(view.getUint32(4,true),48);assert.equal(view.getUint16(20,true),1);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),48000);assert.equal(view.getUint32(28,true),192000);assert.equal(view.getUint16(32,true),4);assert.equal(view.getUint16(34,true),16);assert.equal(view.getUint32(40,true),12);
 assert.deepEqual(Array.from({length:6},(_,i)=>view.getInt16(44+i*2,true)),[-32768,32767,0,8192,16384,-16384]);
});
test('mono encoding clamps finite peaks and silences non-finite samples',()=>{
 const view=new DataView(encodeWav([new Float32Array([-4,4,NaN,Infinity,-Infinity])],44100));assert.equal(view.getUint16(22,true),1);assert.deepEqual(Array.from({length:5},(_,i)=>view.getInt16(44+i*2,true)),[-32768,32767,0,0,0]);
});
test('malformed buffers and unsafe durations are rejected before allocating output',()=>{
 for(const channels of [[],[[]],[new Float32Array()],[new Float32Array(2),new Float32Array(3)],Array.from({length:3},()=>new Float32Array(1))])assert.throws(()=>encodeWav(channels,44100));
 for(const rate of [0,7999,96001,NaN,44100.5])assert.throws(()=>encodeWav([new Float32Array(1)],rate));
 assert.throws(()=>encodeWav([new Float32Array(8000*300+1)],8000));
});
