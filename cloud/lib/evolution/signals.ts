/** Bounded, local signal measurements. These are DSP features, not semantic recognition. */
export function audioFeatures(samples:Float32Array,sampleRate:number){
 if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>96000||!samples.length||samples.length>sampleRate*120)throw Error('Audio fuera de los límites de análisis.');
 let sum=0,power=0,peak=0,clipped=0,crossings=0,invalid=0,previous=0;
 for(let i=0;i<samples.length;i++){const raw=samples[i],x=Number.isFinite(raw)?raw:0;if(!Number.isFinite(raw))invalid++;sum+=x;power+=x*x;peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=.999)clipped++;if(i&&((x>=0)!==(previous>=0)))crossings++;previous=x;}
 const mean=sum/samples.length,rms=Math.sqrt(power/samples.length);
 return{frames:samples.length,duration:samples.length/sampleRate,mean,rms,peak,clipped,invalid,zeroCrossingsPerSecond:crossings/(samples.length/sampleRate),dbfs:rms?20*Math.log10(rms):null};
}
/** Stereo-linked DC removal and peak attenuation. Never boosts quiet audio. */
export function masterChannels(channels:Float32Array[],ceiling=.94){
 if(!channels.length||channels.length>2||!channels[0].length||channels[0].length>96000*120||channels.some(c=>c.length!==channels[0].length)||!Number.isFinite(ceiling)||ceiling<.5||ceiling>.98)throw Error('Canales no válidos.');
 const means=channels.map(c=>{let sum=0;for(const v of c)sum+=Number.isFinite(v)?v:0;return sum/c.length;});let peak=0;
 channels.forEach((c,k)=>{for(const v of c)peak=Math.max(peak,Math.abs((Number.isFinite(v)?v:0)-means[k]));});
 const gain=peak>ceiling?ceiling/peak:1;
 return{channels:channels.map((c,k)=>Float32Array.from(c,v=>((Number.isFinite(v)?v:0)-means[k])*gain)),gain,removedDC:means,ceiling};
}
export function imageFeatures(rgba:Uint8ClampedArray,width:number,height:number){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1048576||rgba.length!==width*height*4)throw Error('Imagen fuera de los límites de análisis.');
 let count=0,sum=0,sq=0,edge=0,edges=0;const histogram=Array<number>(16).fill(0),gray=new Float32Array(width*height);
 for(let i=0;i<gray.length;i++){const k=i*4,a=rgba[k+3]/255,v=(.2126*rgba[k]+.7152*rgba[k+1]+.0722*rgba[k+2])/255;gray[i]=v;if(!a)continue;count++;sum+=v;sq+=v*v;histogram[Math.min(15,Math.floor(v*16))]++;if(i%width&&rgba[k-1]){edge+=Math.abs(v-gray[i-1]);edges++;}if(i>=width&&rgba[k-width*4+3]){edge+=Math.abs(v-gray[i-width]);edges++;}}
 const luminance=count?sum/count:0;
 return{width,height,visiblePixels:count,luminance,contrast:Math.sqrt(Math.max(0,count?sq/count-luminance*luminance:0)),edgeEnergy:edges?edge/edges:0,histogram};
}
