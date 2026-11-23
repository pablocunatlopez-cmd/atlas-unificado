/** Data-only interchange between Atlas' project builder and ERAS' renderer. */
export const ERAS_SCENE_LIMITS=Object.freeze({objects:256,materials:32,characters:180000});
const finite=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(label+' fuera de rango.');return value;};
const vector=(value,min,max,label)=>{if(!Array.isArray(value)||value.length!==3)throw Error(label+' necesita tres números.');return value.map((n,i)=>finite(n,min,max,label+' '+i));};
const text=(value,fallback,max)=>typeof value==='string'?value.trim().slice(0,max)||fallback:fallback;
export function validateSceneDocument(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('La escena debe ser un documento de datos.');
 let size;try{size=JSON.stringify(raw).length;}catch{throw Error('La escena no se puede serializar.');}if(size>ERAS_SCENE_LIMITS.characters)throw Error('La escena supera el presupuesto de datos.');
 if(!Array.isArray(raw.materials)||raw.materials.length<1||raw.materials.length>ERAS_SCENE_LIMITS.materials)throw Error('La escena admite entre 1 y 32 materiales.');
 const materials=raw.materials.map((m,i)=>{if(!m||typeof m!=='object')throw Error('Material inválido.');return{color:vector(m.color,0,1,'Color '+i),roughness:finite(m.roughness,0,1,'Rugosidad'),metalness:finite(m.metalness,0,1,'Metal'),emission:finite(m.emission,0,12,'Emisión')};});
 if(!Array.isArray(raw.objects)||raw.objects.length<1||raw.objects.length>ERAS_SCENE_LIMITS.objects)throw Error('La escena admite entre 1 y 256 objetos.');
 const objects=raw.objects.map((o,i)=>{if(!o||!['box','sphere','cylinder','cone'].includes(o.type))throw Error('Forma no admitida en el objeto '+i+'.');if(!Number.isInteger(o.material)||!materials[o.material])throw Error('El material del objeto no existe.');return{type:o.type,position:vector(o.position,-100,100,'Posición'),size:vector(o.size,.001,100,'Semiejes'),material:o.material,yaw:finite(o.yaw??0,-Math.PI*8,Math.PI*8,'Giro'),name:text(o.name,'Objeto '+(i+1),100),...(['goal','player','obstacle'].includes(o.tag)?{tag:o.tag}:{})};});
 const camera=vector(raw.camera,-500,500,'Cámara'),target=vector(raw.target,-200,200,'Objetivo');if(Math.hypot(...camera.map((n,i)=>n-target[i]))<.1)throw Error('La cámara necesita distancia al objetivo.');
 const sun=vector(raw.sun,-100,100,'Sol');if(Math.hypot(...sun)<.001)throw Error('La dirección del sol no puede ser nula.');
 const brief=raw.brief&&typeof raw.brief==='object'?raw.brief:raw;
 return{version:1,engine:'ERAS',title:text(brief.title||raw.title,'Escena de Lía',100),mode:['image','3d','game'].includes(brief.mode)?brief.mode:'3d',lighting:['day','sunset','night'].includes(brief.lighting)?brief.lighting:'day',quality:brief.quality==='high'?'high':'balanced',objects,materials,camera,target,sky:vector(raw.sky,0,1,'Cielo'),sun,fog:finite(raw.fog??0,0,.1,'Bruma'),exposure:finite(raw.exposure??1,.1,3,'Exposición')};
}
export function acceptsEngineMessage(event,expectedParent,expectedOrigin){return event.source===expectedParent&&event.origin===expectedOrigin&&!!event.data&&typeof event.data==='object'&&/^atlas:eras:(load|snapshot|pause|reset|dispose)$/.test(event.data.type);}
export function engineRequestId(value){if(typeof value!=='string'||!value||value.length>120||/[\u0000-\u001f]/.test(value))throw Error('Identificador de solicitud inválido.');return value;}
