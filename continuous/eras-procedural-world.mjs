/**
 * ERAS procedural world blueprint generator.
 * Browser-safe, deterministic, no dependencies or GPU requirements.
 * Output is a scene manifest, not rendered geometry or production assets.
 */
function hash32(value){
 let h=2166136261;
 for(let i=0;i<value.length;i++){h=Math.imul(h^value.charCodeAt(i),16777619);}
 return h>>>0;
}
function random(seed){let x=seed>>>0;return ()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function generateErasWorldChunk({seed=1,chunkX=0,chunkZ=0,size=64,vegetation=24}={}){
 if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(chunkX)||!Number.isSafeInteger(chunkZ)||
   !Number.isFinite(size)||size<8||size>256||
   !Number.isSafeInteger(vegetation)||vegetation<0||vegetation>2000)
   throw Error('Invalid world chunk parameters');
 const rng=random(hash32([seed,chunkX,chunkZ].join(':')));
 const objects=[];
 for(let i=0;i<vegetation;i++){
   const x=Number((chunkX*size+rng()*size).toFixed(3));
   const z=Number((chunkZ*size+rng()*size).toFixed(3));
   const scale=Number((.65+rng()*1.1).toFixed(3));
   const type=rng()<.75?'tree':'rock';
   objects.push({id:`chunk-${chunkX}-${chunkZ}-${i}`,type,position:[x,0,z],
     rotationY:Number((rng()*Math.PI*2).toFixed(4)),scale,lodGroup:type});
 }
 return {schemaVersion:1,seed,chunk:[chunkX,chunkZ],size,objects};
}
