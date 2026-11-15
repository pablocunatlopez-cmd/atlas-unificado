import * as THREE from './vendor/three.module.js';

export const VISUAL_KEY='eras.visual.v1';
export const LIGHTING_PRESETS=Object.freeze({
  daylight:{name:'Día claro',note:'Luz neutra · relieve y detalle',direction:[-28,38,-35],sun:0xffedce,intensity:3.4,zenith:0x5685ab,horizon:0xd6dee0,fog:0xb4c9d0,ambient:.78,environment:.65,clouds:.55,warmth:.008},
  golden:{name:'Hora dorada',note:'Sol bajo · sombras largas',direction:[-42,16,-28],sun:0xffc78f,intensity:3.1,zenith:0x577890,horizon:0xefd0a5,fog:0xc1ae99,ambient:.58,environment:.43,clouds:.32,warmth:.028},
  dawn:{name:'Amanecer',note:'Cielo frío · luz de cobre',direction:[-45,11,24],sun:0xffac78,intensity:2.2,zenith:0x3c5b7b,horizon:0xd6aaa1,fog:0x929faf,ambient:.48,environment:.34,clouds:.44,warmth:.016},
  overcast:{name:'Cielo cubierto',note:'Luz suave · atmósfera húmeda',direction:[-20,45,-15],sun:0xd4dfea,intensity:1.3,zenith:0x7f929f,horizon:0xc4ced1,fog:0xa4b8c1,ambient:1.1,environment:.75,clouds:1,warmth:-.008},
});
export function visualSettings(value={}){
  const finite=(v,fallback,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
  return{preset:Object.hasOwn(LIGHTING_PRESETS,value?.preset)?value.preset:'daylight',haze:finite(value?.haze,1,0,1.8),rays:value?.rays!==false,exposure:finite(value?.exposure,1.05,.55,1.65)};
}
export function readVisualSettings(){try{return visualSettings(JSON.parse(localStorage.getItem(VISUAL_KEY)||'{}'));}catch{return visualSettings();}}
export function saveVisualSettings(value){try{localStorage.setItem(VISUAL_KEY,JSON.stringify(visualSettings(value)));return true;}catch{return false;}}

// One light direction drives the sky, shadows and the screen-space scattering.
export function applyLighting(w,value={},refreshEnvironment=true){
  w.visual=visualSettings(value);const p=LIGHTING_PRESETS[w.visual.preset];
  const space=['moon','alien'].includes(w.era?.biome);
  const direction=w.visual.preset==='daylight'&&w.surfaces?.daylightDirection?w.surfaces.daylightDirection.toArray():p.direction;
  w.sunOffset=new THREE.Vector3(...(space?[-28,24,-35]:direction));
  if(w.sun){w.sun.color.setHex(space?0xffdfb4:p.sun);w.sun.intensity=space?3.1:p.intensity;w.sunBase=w.sun.intensity;}
  if(w.hemisphere)w.hemisphere.intensity=space?.6:p.ambient;
  if(w.scene?.fog)w.scene.fog.density=(space?.004:w.visual.preset==='overcast'?.0028:.0018)*w.visual.haze;
  if(w.scene&&!space){w.scene.fog?.color.setHex(p.fog);w.scene.environmentIntensity=p.environment;}
  if(w.skyDome){
    const photographic=!space&&w.visual.preset==='daylight'&&w.surfaces?.panorama;
    w.skyDome.visible=!photographic;
    if(w.scene){w.scene.background=photographic?w.surfaces.panorama:new THREE.Color(w.era?.sky||0x547e99);w.scene.backgroundIntensity=.68;}
  }
  const uniforms=w.skyDome?.material.uniforms;
  if(uniforms&&!space){uniforms.zenith.value.setHex(p.zenith);uniforms.horizon.value.setHex(p.horizon);uniforms.sunDir.value.copy(w.sunOffset).normalize();uniforms.cloudAmount.value=p.clouds;}
  if(w.pipeline){
    w.pipeline.lighting={direction:w.sunOffset.clone().normalize(),color:new THREE.Color(space?0xffffff:p.sun),strength:space||!w.visual.rays?0:(w.visual.preset==='overcast'?.025:.10)*w.visual.haze};
    w.pipeline.material.uniforms.warmth.value=space?0:p.warmth;
    if(w.pipeline.material.uniforms.aerialDensity){
      w.pipeline.material.uniforms.aerialDensity.value=space?0:.0017*w.visual.haze;
      w.pipeline.material.uniforms.aerialColor.value.setHex(p.fog);
    }
  }
  if(refreshEnvironment)w.refreshEnvironment?.();
  return w.visual;
}
