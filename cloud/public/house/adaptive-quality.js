// Feedback from measured frame rates changes rendering resources only. These
// adjustments do not train a model or establish that the world has learned facts.
const SLOW_FPS=24,SLOW_SAMPLES=3,FAST_SAMPLES=8,WARMUP_SAMPLES=2,SCALE=.85;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createAdaptiveQuality({maxPixelRatio=1.5,initialPixelRatio=maxPixelRatio,maxPeople=2,minPixelRatio=.85,mobile=false}={}){
 if(!finite(minPixelRatio)||minPixelRatio<=0||!finite(maxPixelRatio)||maxPixelRatio<minPixelRatio||!finite(initialPixelRatio)||!Number.isInteger(maxPeople)||maxPeople<0||maxPeople>2)throw new RangeError('Invalid adaptive rendering bounds.');
 let pixelRatio=clamp(initialPixelRatio,minPixelRatio,maxPixelRatio),people=maxPeople,warmup=0,slow=0,fast=0;
 const fastFps=mobile?36:50;
 const result=(changed,reason)=>({pixelRatio,people,changed,reason});
 return{
  sample({fps}={}){
   // Paused, absent and malformed measurements must not consume warmup or alter
   // streaks. The runtime calls this only for an observed active render interval.
   if(!finite(fps)||fps<=0)return result(false,'invalid-sample');
   if(warmup<WARMUP_SAMPLES){warmup++;return result(false,'warmup');}
   if(fps<SLOW_FPS){
    fast=0;slow++;
    if(slow<SLOW_SAMPLES)return result(false,'stable');
    slow=0;
    const next=clamp(pixelRatio*SCALE,minPixelRatio,maxPixelRatio);
    if(next<pixelRatio){pixelRatio=next;return result(true,'reduced-pixel-ratio');}
    if(people>0){people--;return result(true,'reduced-people');}
    return result(false,'minimum');
   }
   if(fps>=fastFps){
    slow=0;fast++;
    if(fast<FAST_SAMPLES)return result(false,'stable');
    fast=0;
    if(people<maxPeople){people++;return result(true,'restored-people');}
    if(pixelRatio<maxPixelRatio){pixelRatio=clamp(pixelRatio/SCALE,minPixelRatio,maxPixelRatio);return result(true,'restored-pixel-ratio');}
    return result(false,'maximum');
   }
   // A normal interval interrupts either trend. One bad frame or alternating
   // measurements cannot force the detail budget to oscillate.
   slow=0;fast=0;return result(false,'stable');
  }
 };
}
