/**
 * ERAS browser graphics quality governor.
 * Pure JS, compatible with Sites if imported by the ERAS application.
 * Runtime must actually apply these settings to its renderer.
 */
export const ERAS_PROFILES=Object.freeze({
 mobile_low:Object.freeze({pixelRatio:1,shadowCascades:1,shadowMapSize:512,textureBudgetMB:96,foliageDensity:.3,drawDistance:90,postFX:false,targetFPS:30}),
 mobile_high:Object.freeze({pixelRatio:1.5,shadowCascades:2,shadowMapSize:1024,textureBudgetMB:256,foliageDensity:.65,drawDistance:180,postFX:true,targetFPS:45}),
 desktop_high:Object.freeze({pixelRatio:1.75,shadowCascades:3,shadowMapSize:2048,textureBudgetMB:512,foliageDensity:1,drawDistance:350,postFX:true,targetFPS:60}),
 desktop_ultra:Object.freeze({pixelRatio:2,shadowCascades:4,shadowMapSize:4096,textureBudgetMB:1024,foliageDensity:1.5,drawDistance:600,postFX:true,targetFPS:60}),
});
export function selectErasProfile({mobile=false,webgpu=false,deviceMemoryGB=null,averageFrameMs=null}={}){
 if(typeof mobile!=='boolean'||typeof webgpu!=='boolean'||
    (deviceMemoryGB!==null&&(!Number.isFinite(deviceMemoryGB)||deviceMemoryGB<=0))||
    (averageFrameMs!==null&&(!Number.isFinite(averageFrameMs)||averageFrameMs<=0)))
   throw Error('Invalid graphics capabilities');
 let name=mobile?(deviceMemoryGB!==null&&deviceMemoryGB<4?'mobile_low':'mobile_high'):
   (webgpu&&deviceMemoryGB!==null&&deviceMemoryGB>=8?'desktop_ultra':'desktop_high');
 if(averageFrameMs!==null&&averageFrameMs>35)name=mobile?'mobile_low':'desktop_high';
 return {name,settings:{...ERAS_PROFILES[name]}};
}
export function adaptErasQuality(currentName,averageFrameMs){
 if(!Object.hasOwn(ERAS_PROFILES,currentName)||!Number.isFinite(averageFrameMs)||averageFrameMs<=0)
   throw Error('Invalid profile or frame time');
 const tiers=['mobile_low','mobile_high','desktop_high','desktop_ultra'];
 const i=tiers.indexOf(currentName);
 const target=ERAS_PROFILES[currentName].targetFPS;
 const next=averageFrameMs>1000/target*1.35?Math.max(0,i-1):
   averageFrameMs<1000/target*.65?Math.min(tiers.length-1,i+1):i;
 return {name:tiers[next],settings:{...ERAS_PROFILES[tiers[next]]}};
}
