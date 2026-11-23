import {test} from 'node:test';
import assert from 'node:assert/strict';
import {channelMetrics} from '../lib/evolution/signals.ts';
import {encodeWav} from '../lib/music/wav.mjs';
const f=(...x:number[])=>new Float32Array(x);
test('el PCM exportado contiene señal en el canal derecho aunque el izquierdo esté en silencio',()=>{
 const channels=[f(0,0),f(1,-1)],pcm=new DataView(encodeWav(channels,8000));
 assert.deepEqual([44,46,48,50].map(offset=>pcm.getInt16(offset,true)),[0,32767,0,-32768]);
 const m=channelMetrics(channels,8000);assert.equal(m.peak,1);assert.equal(m.clipped,2);assert.equal(m.rms,Math.sqrt(.5));assert.deepEqual(m.dc,[0,0]);
});
test('no cancelar señales opuestas ni tratar dos canales como doble duración',()=>{
 const m=channelMetrics([f(.5,.5),f(-.5,-.5)],8000);
 assert.equal(m.rms,.5);assert.equal(m.duration,2/8000);assert.deepEqual(m.dc,[.5,-.5]);
 assert.deepEqual(channelMetrics([f(0)],8000),{duration:1/8000,peak:0,rms:0,dc:[0],clipped:0});
 assert.throws(()=>channelMetrics([f(1),f(0,0)],8000));assert.throws(()=>channelMetrics([],8000));
});
