import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaptiveQuality} from '../../public/house/adaptive-quality.js';
const feed=(controller,fps,count=1)=>{let value;for(let i=0;i<count;i++)value=controller.sample({fps});return value;};
const warmed=options=>{const controller=createAdaptiveQuality(options);feed(controller,30,2);return controller;};

test('startup and isolated slow intervals do not reduce the detail budget',()=>{
 const c=createAdaptiveQuality({maxPeople:2,maxPixelRatio:1.5});
 assert.equal(feed(c,10,2).reason,'warmup');
 assert.equal(feed(c,10,2).changed,false);
 assert.deepEqual(feed(c,30),{pixelRatio:1.5,people:2,changed:false,reason:'stable'});
 assert.equal(feed(c,10,2).people,2);
 assert.equal(feed(c,10).reason,'reduced-pixel-ratio');
});

test('sustained pressure preserves anatomy while reducing resolution toward the floor',()=>{
 const c=warmed({maxPeople:2,maxPixelRatio:1.5,minPixelRatio:.85});
 const first=feed(c,12,3);assert.equal(first.people,2);assert.equal(first.reason,'reduced-pixel-ratio');
 const floor=feed(c,12,9);assert.equal(floor.pixelRatio,.85);assert.equal(floor.people,2);
 assert.equal(feed(c,12,3).people,1);
 assert.equal(feed(c,12,3).people,0);
 assert.equal(feed(c,12,30).changed,false);
});

test('recovery restores nearby anatomy before resolution',()=>{
 const c=warmed({maxPeople:2,maxPixelRatio:1.5});
 feed(c,10,18);
 const pending=feed(c,60,7);assert.equal(pending.people,0);assert.equal(pending.changed,false);assert.equal(pending.pixelRatio,.85);
 assert.deepEqual(feed(c,60),{pixelRatio:.85,people:1,changed:true,reason:'restored-people'});
 assert.equal(feed(c,60,8).people,2);
 assert.equal(feed(c,60,8).reason,'restored-pixel-ratio');
 assert.deepEqual(feed(c,60,80),{pixelRatio:1.5,people:2,changed:false,reason:'maximum'});
});

test('normal and alternating intervals break trends; mobile recovery uses its own measured threshold',()=>{
 const desktop=warmed({maxPeople:1,maxPixelRatio:1,minPixelRatio:1});feed(desktop,10,3);
 for(let i=0;i<10;i++){feed(desktop,60,7);assert.equal(feed(desktop,30).people,0);}
 assert.equal(feed(desktop,40,40).people,0);assert.equal(feed(desktop,50,8).people,1);
 const mobile=warmed({maxPeople:1,maxPixelRatio:1,minPixelRatio:1,mobile:true});feed(mobile,10,3);
 assert.equal(feed(mobile,35,20).people,0);assert.equal(feed(mobile,36,8).people,1);
});

test('invalid observations leave the controller unchanged and configuration cannot escape its bounds',()=>{
 const c=createAdaptiveQuality({maxPeople:0,maxPixelRatio:1.4,initialPixelRatio:8,minPixelRatio:.9});
 for(const fps of [undefined,null,NaN,Infinity,-1,0,'10'])assert.deepEqual(c.sample({fps}),{pixelRatio:1.4,people:0,changed:false,reason:'invalid-sample'});
 assert.equal(feed(c,10,2).reason,'warmup');feed(c,10,2);c.sample({fps:NaN});assert.equal(feed(c,10).reason,'reduced-pixel-ratio');
 for(let i=0;i<1000;i++){const value=feed(c,i%2?10:60);assert.ok(value.pixelRatio>=.9&&value.pixelRatio<=1.4);assert.equal(value.people,0);}
 assert.equal(warmed({initialPixelRatio:-5}).sample({fps:30}).pixelRatio,.85);
 for(const options of [{maxPixelRatio:NaN},{minPixelRatio:0},{maxPixelRatio:.5,minPixelRatio:.85},{maxPeople:3},{maxPeople:1.5},{initialPixelRatio:'1'}])assert.throws(()=>createAdaptiveQuality(options),RangeError);
});
