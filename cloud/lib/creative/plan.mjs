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
// Version 1 remains the legacy preset-plus-details contract. Version 2 is an
// authored scene: its bounded objects replace the preset, rather than decorate it.
export const CREATIVE_SCENE_OBJECT_LIMIT=32;
export const CREATIVE_GAME_OBJECT_LIMIT=24;
const identifier=value=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(value);
const rotate=(p,yaw)=>[Math.cos(yaw)*p[0]+Math.sin(yaw)*p[2],p[1],-Math.sin(yaw)*p[0]+Math.cos(yaw)*p[2]];
const wrapYaw=value=>Math.atan2(Math.sin(value),Math.cos(value));
function resolveGroups(input){
 if(input===undefined)return new Map();
 if(!Array.isArray(input)||input.length>8)throw Error('El plan admite hasta ocho grupos de transformación.');
 const groups=new Map(),resolved=new Map();
 for(const group of input){
  if(!group||!identifier(group.id)||groups.has(group.id)||!vector(group.position,-24,24)||!number(group.yaw??0,-Math.PI,Math.PI)||!number(group.scale??1,.25,4)||(group.parent!==undefined&&!identifier(group.parent)))throw Error('Grupo inválido: usa id único, position, yaw y escala uniforme entre 0.25 y 4.');
  groups.set(group.id,{position:[...group.position],yaw:group.yaw??0,scale:group.scale??1,parent:group.parent});
 }
 const visit=(id,chain=[])=>{
  if(resolved.has(id))return resolved.get(id);
  if(chain.includes(id)||chain.length>=4)throw Error('Los grupos no pueden contener ciclos ni más de cuatro niveles.');
  const group=groups.get(id);if(!group)throw Error('Referencia a un grupo inexistente.');
  let result={position:group.position,yaw:group.yaw,scale:group.scale,depth:1};
  if(group.parent){const parent=visit(group.parent,[...chain,id]),offset=rotate(group.position.map(n=>n*parent.scale),parent.yaw);result={position:offset.map((n,i)=>n+parent.position[i]),yaw:wrapYaw(parent.yaw+group.yaw),scale:parent.scale*group.scale,depth:parent.depth+1};}
  if(result.depth>4)throw Error('Los grupos no pueden contener más de cuatro niveles.');
  resolved.set(id,result);return result;
 };
 for(const id of groups.keys())visit(id);
 return resolved;
}
export function validateCreativePlan(value,mode='3d'){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('El plan no es un objeto.');
 const version=value.version??1;if(version!==1&&version!==2)throw Error('Versión de plan no soportada.');
 const authored=version===2,variants=mode==='game'?['driving','exploration']:['gallery','product','architecture','forest','neon'];
 if(!variants.includes(value.variant))throw Error('El escenario no está soportado en este modo.');
 if(!['day','sunset','night'].includes(value.lighting))throw Error('La iluminación no es válida.');
 const palette=paletteName(value.palette);
 if(typeof value.title!=='string'||!value.title.trim()||value.title.length>90)throw Error('El título debe tener entre 1 y 90 caracteres.');
 const materials=authored?(value.materials??[]):[];
 if(!Array.isArray(materials)||materials.length>8)throw Error('El plan admite hasta ocho materiales personalizados.');
 const safeMaterials=materials.map(material=>{
  if(!material||!vector(material.color,0,1)||!number(material.roughness,.04,1)||!number(material.metalness,0,1)||!number(material.emission??0,0,4))throw Error('Material inválido: color RGB 0–1, roughness 0.04–1, metalness 0–1 y emission 0–4.');
  return {color:[...material.color],roughness:material.roughness,metalness:material.metalness,emission:material.emission??0};
 });
 const groups=resolveGroups(authored?value.groups:undefined),objects=value.objects??[],limit=authored?(mode==='game'?CREATIVE_GAME_OBJECT_LIMIT:CREATIVE_SCENE_OBJECT_LIMIT):8;
 if(!Array.isArray(objects)||objects.length>limit||(authored&&objects.length===0))throw Error(authored?'El plan completo requiere entre 1 y '+limit+' objetos.':'El plan admite hasta ocho detalles adicionales.');
 const safeObjects=objects.map((object,index)=>{
  if(!object||!(authored?['box','sphere','cylinder','cone']:['box','sphere']).includes(object.type)||!vector(object.position,-24,24)||!vector(object.size,authored?.04:.1,authored?12:3)||!Number.isInteger(object.material)||object.material<0||object.material>11+safeMaterials.length||!number(object.yaw??0,-Math.PI,Math.PI))throw Error('Un objeto tiene geometría fuera de los límites.');
  let position=[...object.position],size=[...object.size],yaw=object.yaw??0;
  if(authored&&object.group!==undefined){const group=groups.get(object.group);if(!group)throw Error('Un objeto referencia un grupo inexistente.');const offset=rotate(position.map(n=>n*group.scale),group.yaw);position=offset.map((n,i)=>n+group.position[i]);size=size.map(n=>n*group.scale);yaw=wrapYaw(yaw+group.yaw);}
  const maximumHeight=authored?24:8,tolerance=authored?.025:.1;
  if(!vector(position,-24,24)||!vector(size,authored?.04:.1,authored?12:3)||position[1]<size[1]-tolerance||position[1]>maximumHeight)throw Error('Objeto '+(index+1)+': position[1]='+position[1]+' debe ser al menos size[1]='+size[1]+' y como máximo '+maximumHeight+'. Eleva el centro o reduce el semieje vertical.');
  const xExtent=Math.abs(Math.cos(yaw))*size[0]+Math.abs(Math.sin(yaw))*size[2],zExtent=Math.abs(Math.sin(yaw))*size[0]+Math.abs(Math.cos(yaw))*size[2];
  if(authored&&(Math.abs(position[0])+xExtent>32||Math.abs(position[2])+zExtent>32||position[1]+size[1]>32))throw Error('El conjunto debe caber en x/z ±32 y altura 32.');
  if(authored&&object.collision!==undefined&&typeof object.collision!=='boolean')throw Error('collision debe ser booleano.');
  const collision=authored?(object.collision!==false&&position[1]-size[1]<2.2&&position[1]+size[1]>.2):true;
  const spawnZ=authored&&value.variant==='driving'?13:8;
  if(mode==='game'&&collision&&Math.abs(position[0])<xExtent+2&&Math.abs(position[2]-spawnZ)<zExtent+2)throw Error('Un objeto invade el punto de inicio.');
  const name=authored&&typeof object.name==='string'?object.name.trim().slice(0,64):undefined;
  return {type:object.type,position,size,material:object.material,yaw,...(name?{name}:{}),...(mode==='game'?{...(authored?{collision}:{}),...(collision?{tag:'obstacle'}:{})}:{})};
 });
 let camera,target;
 if(authored&&(value.camera!==undefined||value.target!==undefined)){
  if(!vector(value.camera,-96,96)||value.camera[1]<.25||value.camera[1]>80||!vector(value.target,-24,24)||value.target[1]<0||Math.hypot(...value.camera.map((n,i)=>n-value.target[i]))<1)throw Error('camera y target deben ser vectores válidos separados al menos una unidad; cámara por encima del suelo.');
  for(const object of safeObjects){const local=rotate(value.camera.map((n,i)=>n-object.position[i]),-object.yaw);if(local.every((n,i)=>Math.abs(n)<object.size[i]+.1))throw Error('La cámara no puede estar dentro de la geometría.');}
  camera=[...value.camera];target=[...value.target];
 }
 // Group transforms have been compiled into world-space objects. Discard their
 // input references so validating a normalized plan twice is idempotent.
 return {version,title:value.title.trim(),variant:value.variant,lighting:value.lighting,palette,objects:safeObjects,design:typeof value.design==='string'?value.design.slice(0,500):'',...(authored?{materials:safeMaterials,...(camera?{camera,target}:{})}:{})};
}
export function creativePlanPrompt(prompt,mode){
 const example={version:2,title:'Pabellón circular',variant:mode==='game'?'exploration':'architecture',lighting:'sunset',palette:'Blanco',design:'Columnas que sostienen una cubierta cónica; centro abierto y pavimento oscuro.',materials:[{color:[.16,.32,.38],roughness:.3,metalness:.45,emission:0}],objects:[{name:'Pavimento',type:'cylinder',position:[0,.12,0],size:[4,.12,4],material:8,yaw:0,collision:false},{name:'Columna izquierda',type:'cylinder',position:[-2,1.7,-2],size:[.18,1.7,.18],material:12,yaw:0},{name:'Columna derecha',type:'cylinder',position:[2,1.7,-2],size:[.18,1.7,.18],material:12,yaw:0},{name:'Cubierta',type:'cone',position:[0,4,0],size:[4,.6,4],material:1,yaw:0,collision:false}]};
 return `Eres el arquitecto 3D de Atlas. Construye el OBJETO O ENTORNO pedido mediante una composición original de geometría real, no una descripción ni el mismo museo para todos. Devuelve SOLO JSON, version:2. Tus objects SUSTITUYEN toda la arquitectura predeterminada: dibuja TODOS los componentes necesarios. Solo se conservan suelo, sol, cielo, cámara y, en juegos, jugador y ocho objetivos. Ejemplo de TIPOS (no lo copies si no corresponde): ${JSON.stringify(example)}. Diseña silueta reconocible, estructura completa, proporciones coherentes, jerarquía visual, detalles útiles, materiales variados y espacio negativo. Usa tantos objetos como necesite el encargo, de 1 a ${mode==='game'?CREATIVE_GAME_OBJECT_LIMIT:CREATIVE_SCENE_OBJECT_LIMIT}; no desperdicies el presupuesto repitiendo decoraciones irrelevantes. title 1–90 caracteres; variant UN texto entre ${mode==='game'?'"driving", "exploration"':'"gallery", "product", "architecture", "forest", "neon"'} (solo establece atmósfera, no añade edificios). lighting "day", "sunset" o "night". palette UN SOLO texto: ${CREATIVE_PALETTES.map(name=>JSON.stringify(name)).join(', ')}. Ejemplo correcto: "palette":"Blanco". No uses arrays ni combines nombres de paletas. objects: type "box", "sphere", "cylinder" o "cone"; position y size son arrays de tres números; yaw giro Y en radianes -3.14 a 3.14. size son SEMIEJES/radios entre 0.04 y 12; una caja size:[2,1,3] mide 4×2×6. Cilindros/conos tienen eje Y, base en -size[1] y cima en +size[1]. Centro y >= size[1], y <=24; x/z entre -24 y 24. La geometría completa debe caber en x/z ±32 y altura32. name opcional hasta64 caracteres. Material entero: 0 piedra,1 blanco,2 acento metálico,3 vegetación,4 madera,5 oro,6 luz cálida,7 neón,8 oscuro,9 plata,10 terracota,11 azul. materials permite hasta8 colores PBR propios: {color:[r,g,b] 0–1,roughness:0.04–1,metalness:0–1,emission:0–4}; se numeran desde12 según orden. Evita abusar de emisión. Puedes montar piezas con groups (máximo8): {id:"ala",position:[x,y,z],yaw:0,scale:1,parent:"otro" opcional}; object.group referencia id. Escala uniforme0.25–4, máximo4 niveles; se validan las medidas finales en coordenadas del mundo. Sin groups las posiciones son mundiales. ${mode==='game'?'Deja libre el inicio (x=0,z=13 para driving; x=0,z=8 para exploration), con 2 unidades de margen. Mantén caminos anchos y navegables. collision:false para pavimentos, tejados o decoración atravesable; las paredes bajas son obstáculos. El motor conserva y sitúa ocho objetivos en el área accesible.':'El motor encuadra automáticamente TODOS tus objetos. La composición principal debe estar centrada cerca del origen. Opcional: camera:[x,y,z] y target:[x,y,z] juntos, cámara fuera de geometría y encima del suelo; omítelos para encuadre automático.'} design en español hasta500 caracteres. Solo datos acotados: sin código, shaders, texturas remotas ni URL. Encargo del usuario: ${JSON.stringify(prompt.slice(0,4000))}`;
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
  const output=await generate('Actúa como revisor del escenario de Atlas. Devuelve JSON {ok:boolean,issues:string[],suggestion:string}. Busca un problema concreto de legibilidad, coherencia con el encargo o navegación; no afirmes que ejecutaste el escenario. Contrato REAL del renderer: los materiales numéricos ya existen: 0 piedra,1 blanco,2 acento metálico,3 vegetación,4 madera,5 oro,6 luz cálida,7 neón,8 oscuro,9 plata,10 terracota,11 azul. En version:2 los objetos constituyen toda la escena, hay cilindros y conos reales, hasta ocho materiales personalizados numerados desde12 y encuadre automático de la composición. En version:1 son detalles del entorno predeterminado. No sugieras shaders, texturas remotas ni código. Revisa si la composición representa el encargo y tiene proporciones razonables. En modo interactivo el inicio x=0,z=8 (exploration) o z=13 (driving) debe quedar despejado. El esquema y los límites geométricos ya fueron comprobados. Distingue un defecto observado en los datos de una preferencia estética; si no hay un defecto concreto usa ok:true,issues:[]. Encargo: '+JSON.stringify(prompt)+' Plan validado: '+JSON.stringify(plan),{signal});
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
