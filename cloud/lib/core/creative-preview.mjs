const variants=new Set(['gallery','product','architecture','forest','neon']),lights=new Set(['day','sunset','night']),palettes=new Set(['Titanio','Oro','Azul','Rojo','Verde','Rosa','Blanco','Negro']);
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const vector=(v,min,max)=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n,min,max));
/** A public plan, never HTML, model instructions, private titles or PC paths. */
export function sanitizeCreativePreview(value){
 if(!value||value.executed!==true||value.invariantsPreserved!==true||value.cases!==6||value.passed!==6||typeof value.artifactId!=='string'||!/^creative-[a-f0-9]{24}$/.test(value.artifactId))return null;
 const p=value.plan;if(!p||!variants.has(p.variant)||!lights.has(p.lighting)||!palettes.has(p.palette)||!Array.isArray(p.objects)||p.objects.length>8)return null;
 const objects=[];for(const o of p.objects){if(!o||!['box','sphere'].includes(o.type)||!vector(o.position,-24,24)||!vector(o.size,.1,3)||!Number.isInteger(o.material)||o.material<0||o.material>11||!finite(o.yaw??0,-Math.PI,Math.PI))return null;objects.push({type:o.type,position:[...o.position],size:[...o.size],material:o.material,yaw:o.yaw??0});}
 const at=typeof value.at==='string'&&Number.isFinite(Date.parse(value.at))?new Date(value.at).toISOString():null;
 return {artifactId:value.artifactId,at,cases:6,passed:6,executed:true,invariantsPreserved:true,renderVerified:false,plan:{version:1,title:'Experimento 3D de Atlas',variant:p.variant,lighting:p.lighting,palette:p.palette,objects,design:''}};
}
