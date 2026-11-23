import test from 'node:test';
import assert from 'node:assert/strict';
import {imageFeatures} from '../lib/evolution/signals.ts';
const gray128=0.21586050011389926; // W3C sRGB decoding, 8-bit reference value.
const pixel=(r:number,g=r,b=r,a=255)=>[r,g,b,a];
const measure=(pixels:number[][],width=pixels.length)=>imageFeatures(new Uint8ClampedArray(pixels.flat()),width,pixels.length/width);
const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

test('sRGB middle gray is 21.586 percent relative luminance, not encoded 50.196 percent',()=>{
 const f=measure([pixel(128)]);assert.equal(f.metric,'srgb-relative-luminance/v1');assert.equal(f.alphaPolicy,'exclude-zero-alpha');near(f.luminance,gray128);near(f.contrast,0);near(f.edgeEnergy,0);
 assert.equal(f.histogram[3],1);assert.equal(f.histogram.reduce((a,b)=>a+b),1);
});
test('linear and power transfer branches, black, white and primary coefficients follow fixed reference values',()=>{
 for(const [rgb,expected] of [[pixel(0),0],[pixel(255),1],[pixel(10),0.003035269835488375],[pixel(11),0.003346535763899161],[pixel(255,0,0),0.2126],[pixel(0,255,0),0.7152],[pixel(0,0,255),0.0722]] as const)near(measure([rgb as number[]]).luminance,expected);
});
test('mean, standard deviation, histogram and adjacent differences use the same linear luminance',()=>{
 const f=measure([pixel(0),pixel(128)]);near(f.luminance,gray128/2);near(f.contrast,gray128/2);near(f.edgeEnergy,gray128);
 near(measure([pixel(0),pixel(128)],1).edgeEnergy,gray128);
 assert.equal(f.histogram[0],1);assert.equal(f.histogram[3],1);
});
test('hidden RGB never creates statistics or edges; partial alpha keeps the documented nonzero-alpha policy',()=>{
 const f=measure([pixel(128),pixel(0,255,255,0),pixel(128,128,128,1)],1);
 near(f.luminance,gray128);near(f.contrast,0);near(f.edgeEnergy,0);assert.equal(f.visiblePixels,2);
 assert.equal(f.histogram.reduce((a,b)=>a+b),2);
 const none=measure([pixel(255,255,255,0)]);assert.equal(none.visiblePixels,0);near(none.luminance,0);near(none.contrast,0);near(none.edgeEnergy,0);assert.equal(none.histogram.reduce((a,b)=>a+b),0);
});
test('row boundaries do not create edges, dimensions stay bounded and the pixel array is never changed',()=>{
 const p=new Uint8ClampedArray([...pixel(0),...pixel(0),...pixel(255),...pixel(255)]),copy=p.slice();
 near(imageFeatures(p,2,2).edgeEnergy,.5);assert.deepEqual(p,copy);
 for(const [w,h,size] of [[0,1,0],[1,0,0],[1.5,2,12],[1025,1024,0],[2,2,12]])assert.throws(()=>imageFeatures(new Uint8ClampedArray(size),w,h));
});

test('the maximum one-megapixel image remains accepted with finite statistics',()=>{
 const f=imageFeatures(new Uint8ClampedArray(1024*1024*4).fill(255),1024,1024);
 assert.equal(f.visiblePixels,1048576);near(f.luminance,1);near(f.contrast,0);near(f.edgeEnergy,0);assert.equal(f.histogram[15],1048576);
});
