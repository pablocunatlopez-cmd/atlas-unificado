import {validateLivingProposal} from '../../public/house/living-contract.js';
import {ROOM_IDS} from '../../public/house/layout.js';
export const LIVING_DESIGN_VERSION='atlas-design-kits-1';
export const DESIGN_STYLES=['gallery','observatory','garden','arcade'];
const kits={gallery:{shapes:['arch','crystal','wave','torus'],colors:['#294854','#f4dfb7','#71c7bd'],floor:'tiles'},observatory:{shapes:['helix','torus','crystal','wave'],colors:['#162343','#74e3ed','#d6b6fa'],floor:'rings'},garden:{shapes:['bloom','helix','wave','sphere'],colors:['#143e39','#c2e896','#f0a2be'],floor:'rings'},arcade:{shapes:['arch','crystal','wave','box'],colors:['#2e1955','#7de9f0','#f7c85c'],floor:'grid'}};
export function designLivingKit(raw,style,room){
 if(!DESIGN_STYLES.includes(style)||!ROOM_IDS.includes(room))throw Error('INPUT');const previous=validateLivingProposal(raw),kit=kits[style],count=previous.objects.length;
 const objects=previous.objects.map((object,i)=>({...object,shape:kit.shapes[i%kit.shapes.length],x:Math.round(Math.cos(i/count*Math.PI*2)*.85*1000)/1000,z:Math.round(Math.sin(i/count*Math.PI*2)*.85*1000)/1000,y:.3+(i%3)*.15,color:i%3}));
 const proposal=validateLivingProposal({...previous,title:({'gallery':'Galería de formas','observatory':'Órbitas y cristales','garden':'Jardín de resonancias','arcade':'Arcada de luz'})[style],goal:'Variación creada con un kit procedural a partir de la obra anterior. Conserva su composición musical y añade geometría y arquitectura editables.',colors:kit.colors,environment:{style,floor:kit.floor,intensity:.55},objects,walk:true,film:{rooms:[room,...previous.film.rooms.filter(r=>r!==room)].slice(0,4),seconds:previous.film.seconds}});
 return{proposal,scope:'Variante de diseño creada por reglas del motor, sin inferencia. No es una nueva composición de IA ni una mejora estética demostrada.'};
}
export function livingBudget(row,at=Date.now()){
 const day=new Date(at).toISOString().slice(0,10),used=row?.day===day&&Number.isSafeInteger(row.requests)?row.requests:0,blocked=row?.day===day&&Number.isFinite(row.blocked_until)?Math.max(0,row.blocked_until):0;
 const tomorrow=Date.parse(day+'T00:00:00Z')+86400000,backgroundAvailable=used<=46&&blocked<=at,manualAvailable=used<=58&&blocked<=at;
 return{day,used,automaticLimit:48,manualLimit:60,backgroundAvailable,manualAvailable,nextAvailableAt:backgroundAvailable?null:new Date(used>46?tomorrow:Math.min(tomorrow,Math.max(at,blocked))).toISOString()};
}
