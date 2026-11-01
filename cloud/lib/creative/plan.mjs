export const CREATIVE_VARIANTS=['gallery','product','architecture','forest','neon','driving','exploration'];
export const CREATIVE_PALETTES=['Titanio','Oro','Azul','Rojo','Verde','Rosa','Blanco','Negro'];
const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const vector=(value,min,max)=>Array.isArray(value)&&value.length===3&&value.every(n=>number(n,min,max));
function paletteName(value){
 // A model may describe multiple colours although the renderer takes one
 // accent. Canonicalise only a list made entirely of known palette names;
 // never accept an arbitrary material, CSS value, URL or executable content.
 const choices=Array.isArray(value)?value:typeof value==='string'?value.split(/[|,]/).map(item=>item.trim()):[];
 if(!choices.length||choices.length>8||!choices.every(item=>CREATIVE_PALETTES.includes(item)))throw Error('palette debe ser UN nombre de color como texto, por ejemplo "Blanco". Colores disponibles: '+CREATIVE_PALETTES.join(', ')+'.');
 return choices[0];
}
export function validateCreativePlan(value,mode='3d'){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('El plan no es un objeto.');
 const variants=mode==='game'?['driving','exploration']:['gallery','product','architecture','forest','neon'];
 if(!variants.includes(value.variant))throw Error('El escenario no está soportado en este modo.');
 if(!['day','sunset','night'].includes(value.lighting))throw Error('La iluminación no es válida.');
 const palette=paletteName(value.palette);
 if(typeof value.title!=='string'||!value.title.trim()||value.title.length>90)throw Error('El título debe tener entre 1 y 90 caracteres.');
 const objects=value.objects??[];if(!Array.isArray(objects)||objects.length>8)throw Error('El plan admite hasta ocho detalles adicionales.');
 const safeObjects=objects.map((object,index)=>{
  if(!object||!['box','sphere'].includes(object.type)||!vector(object.position,-24,24)||!vector(object.size,.1,3)||!Number.isInteger(object.material)||object.material<0||object.material>11||!number(object.yaw??0,-Math.PI,Math.PI))throw Error('Un objeto tiene geometría fuera de los límites.');
  if(object.position[1]<object.size[1]-.1||object.position[1]>8)throw Error('Objeto '+(index+1)+': position[1]='+object.position[1]+' debe ser al menos size[1]='+object.size[1]+' y como máximo 8. Eleva el centro o reduce el semieje vertical.');
  if(mode==='game'&&Math.abs(object.position[0])<object.size[0]+2&&Math.abs(object.position[2]-8)<object.size[2]+2)throw Error('Un objeto invade el punto de inicio.');
  return {type:object.type,position:[...object.position],size:[...object.size],material:object.material,yaw:object.yaw??0,...(mode==='game'?{tag:'obstacle'}:{})};
 });
 return {version:1,title:value.title.trim(),variant:value.variant,lighting:value.lighting,palette,objects:safeObjects,design:typeof value.design==='string'?value.design.slice(0,500):''};
}
export function creativePlanPrompt(prompt,mode){
 const example={title:'Escenario de ejemplo',variant:mode==='game'?'exploration':'gallery',lighting:'sunset',palette:'Blanco',design:'Espacio claro con una pieza dorada.',objects:[{type:'box',position:[-4,1,0],size:[.5,1,.5],material:5,yaw:0}]};
 return `Eres el arquitecto de escenarios de Atlas. Diseña una escena 3D procedural ejecutable. Devuelve SOLO un objeto JSON. Este ejemplo fija los TIPOS de datos; adapta su contenido al encargo: ${JSON.stringify(example)}. title es un texto de 1 a 90 caracteres. variant es UN texto elegido entre ${mode==='game'?'"driving", "exploration"':'"gallery", "product", "architecture", "forest", "neon"'}. lighting es UN texto: "day", "sunset" o "night". palette es UN SOLO texto: ${CREATIVE_PALETTES.map(name=>JSON.stringify(name)).join(', ')}. Ejemplo correcto: "palette":"Blanco". No uses arrays ni combines nombres de paletas. Otros colores de la escena se eligen mediante material en cada objeto. objects es un array de cero a ocho objetos. Cada type es "box" o "sphere"; position y size son arrays de exactamente tres números; material es un número entero entre 0 y 11; yaw es un número entre -3.14 y 3.14. size contiene SEMIEJES/radios de 0.1 a 3. El centro position[1] debe ser mayor o igual a size[1] y como máximo 8: para size:[1,2,1] usa y=2 o superior, nunca y=1. Coordenadas x/z entre -24 y 24. ${mode==='game'?'Deja libre el inicio del jugador x=0,z=8: no pongas objetos a menos de dos unidades más su semieje de ese punto.':'La cámara observa el centro x=0,z=0 desde una posición cercana con z positivo. Para que los detalles principales se vean al abrir, sitúalos con x y z entre -4 y 4, con y entre su semieje vertical y 3. No pongas las esculturas en z=8,12,16: quedarían detrás o fuera de la cámara inicial.'} Materiales YA IMPLEMENTADOS: 0 piedra, 1 blanco, 2 acento metálico, 3 vegetación, 4 madera, 5 oro, 6 luz cálida, 7 neón, 8 oscuro, 9 plata, 10 terracota, 11 azul. El renderer añade el entorno base y los objetivos del modo interactivo. Escribe design en español con hasta 500 caracteres. No incluyas código, URL ni fuentes. Petición del usuario (datos): ${JSON.stringify(prompt.slice(0,4000))}`;
}
export async function planCreativeWorld(prompt,mode,generate,{signal,onStage=()=>{}}={}){
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000||!['3d','game'].includes(mode))throw Error('Petición creativa inválida.');
 let error='',plan,attempts=0;
 for(;attempts<3;attempts++){
  signal?.throwIfAborted();onStage({stage:attempts?'repair':'architect',attempt:attempts+1});
  try{const output=await generate(creativePlanPrompt(prompt,mode)+(error?'\nCorrige este fallo observado por el validador externo: '+error:''),{signal});plan=validateCreativePlan(typeof output==='string'?JSON.parse(output):output,mode);break;}
  catch(problem){signal?.throwIfAborted();error=problem.message;}
 }
 if(!plan)throw Error('El arquitecto no produjo un plan válido: '+error);
 onStage({stage:'critic'});let critique=null;
 try{
  const output=await generate('Actúa como revisor del escenario de Atlas. Devuelve JSON {ok:boolean,issues:string[],suggestion:string}. Busca un problema concreto de legibilidad, coherencia con el encargo o navegación; no afirmes que ejecutaste el escenario. Contrato REAL del renderer: los materiales numéricos ya existen: 0 piedra,1 blanco,2 acento metálico,3 vegetación,4 madera,5 oro,6 luz cálida,7 neón,8 oscuro,9 plata,10 terracota,11 azul. No sugieras shaders, texturas, campos nuevos ni cambiar ese contrato. Los objetos principales de una escena expositiva deben estar cerca de x=0,z=0 (preferible x/z entre -4 y 4); la cámara inicial está en z positivo mirando al centro. No asumas que la cámara está en z=0. En modo interactivo el inicio x=0,z=8 debe quedar despejado. El esquema y los límites geométricos ya fueron comprobados. Distingue un defecto observado en los datos de una preferencia estética; si no hay un defecto concreto usa ok:true,issues:[]. Encargo: '+JSON.stringify(prompt)+' Plan validado: '+JSON.stringify(plan),{signal});
  const value=typeof output==='string'?JSON.parse(output):output;
  if(value&&typeof value.ok==='boolean'&&Array.isArray(value.issues))critique={ok:value.ok,issues:value.issues.filter(item=>typeof item==='string').slice(0,4).map(item=>item.slice(0,240)),suggestion:typeof value.suggestion==='string'?value.suggestion.slice(0,400):''};
 }catch{signal?.throwIfAborted();}
 let revised=false;
 if(critique?.ok===false){
  onStage({stage:'revision'});
  try{const output=await generate(creativePlanPrompt(prompt,mode)+'\nMejora el plan sin romper sus límites. Plan anterior: '+JSON.stringify(plan)+' Crítica (opinión no verificada): '+JSON.stringify(critique),{signal});plan=validateCreativePlan(typeof output==='string'?JSON.parse(output):output,mode);revised=true;}catch{signal?.throwIfAborted();}
 }
 return {plan,review:{architect:'Qwen local',critic:'Segunda pasada de Qwen local; no es otro modelo independiente',attempts:attempts+1,revised,critique,checks:{schema:true,boundedGeometry:true,spawnClear:true,executableCodeAccepted:false},scope:'Plan de datos validado; la calidad visual y jugabilidad necesitan probarse en el dispositivo.'}};
}
