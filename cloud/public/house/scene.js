import {createSurfaceMaps,projectSurfaceUV,furnitureBox} from './surface-materials.js';
import {HOUSE_FUNCTIONS} from './functional-world.js?v=surfaces2';
import {createLivingInstallation} from './living-installation.js';
import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {ROOMS,WALLS,roomAt} from './layout.js';
import {createProcessCreatures} from './process-creatures.js?v=housework1';
import {createCreativeInstallation} from './creative-installation.js';

export function buildHouse(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#bfcbd0');scene.fog=new THREE.Fog('#bfcbd0',65,140);
 const statics=new THREE.Group(),ceilings=new THREE.Group();scene.add(statics,ceilings);
 const batches=new Map(),textures=[],interactive=[],solids=[...WALLS],animated=[],components=[];
 const material=(color,more={})=>new THREE.MeshStandardMaterial({color,roughness:.78,metalness:0,...more});
 const palette={wall:material('#e8e4d7'),trim:material('#dad6c7'),wood:material('#826044'),darkWood:material('#443e36'),bronze:material('#756d52',{metalness:.55,roughness:.4}),black:material('#202b2d'),white:material('#f1ede2'),sofa:material('#b8b2a0'),rug:material('#d0c3a9'),green:material('#506b55'),leaf:material('#78906d'),soil:material('#a8b59a'),stone:material('#a9aaa0'),glass:new THREE.MeshPhysicalMaterial({color:'#ecf6f3',transparent:true,opacity:1,transmission:.92,thickness:.055,ior:1.5,metalness:0,roughness:.08,envMapIntensity:1.1,clearcoat:1,depthWrite:false}),glow:material('#9ed9c8',{emissive:'#4d9780',emissiveIntensity:.55,roughness:.3}),blue:material('#84b4c8',{emissive:'#456f8f',emissiveIntensity:.28}),violet:material('#b2a6cf',{emissive:'#615878',emissiveIntensity:.2}),gold:material('#d0ac74',{metalness:.35,roughness:.45})};
 let seed=51977;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const surfaces=Object.fromEntries(['oak','plaster','fabric','stone'].map(kind=>{const maps=createSurfaceMaps(kind);textures.push(...Object.values(maps));return[kind,maps];}));
 const applySurface=(mat,maps,scale=1)=>{Object.assign(mat,maps);mat.normalScale.set(scale,scale);};
 applySurface(palette.wall,surfaces.plaster,.3);palette.wall.color.set('#ffffff');
 applySurface(palette.wood,surfaces.oak,.45);palette.wood.color.set('#ffffff');applySurface(palette.darkWood,surfaces.oak,.45);palette.darkWood.color.set('#665b50');
 applySurface(palette.sofa,surfaces.fabric,.28);palette.sofa.color.set('#ffffff');applySurface(palette.rug,surfaces.fabric,.4);applySurface(palette.stone,surfaces.stone,.22);
 const floor=material('#ffffff',{...surfaces.oak,roughness:.85,normalScale:new THREE.Vector2(.4,.4)});
 function add(geometry,mat,x=0,y=0,z=0,rotation=0){geometry.rotateY(rotation);geometry.translate(x,y,z);const room=roomAt(x,z),bindings=HOUSE_FUNCTIONS.filter(fn=>fn.room===room);components.push({id:'house-part-'+components.length,room:room||'environment',owner:bindings[0]?.owner||'salon-centre',functions:bindings.map(fn=>fn.id),relation:room?'Presentación del espacio de trabajo':'Entorno visual de Lía',source:'public/house/scene.js',geometry:geometry.type});if(mat.map)projectSurfaceUV(geometry);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geometry);}
 function box(mat,w,h,d,x,y,z,rotation=0){add(furnitureBox(w,h,d),mat,x,y,z,rotation);}
 function cyl(mat,top,bottom,height,x,y,z,segments=14){add(new THREE.CylinderGeometry(top,bottom,height,segments),mat,x,y,z);}
 function ball(mat,r,x,y,z,sx=1,sy=1,sz=1){const g=new THREE.SphereGeometry(r,14,10);g.scale(sx,sy,sz);add(g,mat,x,y,z);}
 function obstacle(x,z,w,d){solids.push([x-w/2,z-d/2,x+w/2,z+d/2]);}
 function plant(x,z,size=1){cyl(palette.white,.26*size,.20*size,.45*size,x,.225*size,z);cyl(palette.wood,.028*size,.038*size,.8*size,x,.7*size,z);for(let i=0;i<5;i++){const a=i*2.4;ball(i%2?palette.green:palette.leaf,.27*size,x+Math.sin(a)*.19*size,(.8+i*.13)*size,z+Math.cos(a)*.19*size,1.25,.55,1);}}
 function desk(x,z,rotation=0){box(palette.wood,2.5,.12,1.0,x,.84,z,rotation);for(const dx of [-1.05,1.05])for(const dz of [-.32,.32]){const xx=dx*Math.cos(rotation)+dz*Math.sin(rotation),zz=-dx*Math.sin(rotation)+dz*Math.cos(rotation);box(palette.black,.07,.8,.07,x+xx,.4,z+zz);}obstacle(x,z,rotation?1:2.5,rotation?2.5:1);}
 function chair(x,z,rotation=0,mat=palette.sofa){box(mat,.64,.15,.64,x,.48,z,rotation);box(mat,.64,.7,.12,x+Math.sin(rotation)*.26,.82,z+Math.cos(rotation)*.26,rotation);for(const dx of [-.24,.24])for(const dz of [-.24,.24]){const xx=dx*Math.cos(rotation)+dz*Math.sin(rotation),zz=-dx*Math.sin(rotation)+dz*Math.cos(rotation);box(palette.bronze,.035,.42,.035,x+xx,.23,z+zz);}}
 function monitor(x,z,rotation=0,tint=palette.blue){box(palette.black,1.2,.75,.08,x,1.3,z,rotation);box(tint,1.12,.66,.025,x+Math.sin(rotation)*.055,1.3,z+Math.cos(rotation)*.055,rotation);box(palette.black,.08,.27,.08,x,.95,z);box(palette.black,.42,.035,.28,x,.86,z);}
 function label(room){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=120;const ctx=canvas.getContext('2d');ctx.fillStyle='#14312fdd';ctx.beginPath();ctx.roundRect(6,6,500,108,22);ctx.fill();ctx.strokeStyle='#d4e8dc66';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=room.accent;ctx.font='500 31px system-ui';ctx.textAlign='center';ctx.fillText(room.title,256,54);ctx.fillStyle='#e3ebe0';ctx.font='19px system-ui';ctx.fillText(room.kind+' ↗',256,86);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));sprite.position.set(room.hotspot[0],2.4,room.hotspot[1]);sprite.scale.set(3.1,.73,1);sprite.userData.room=room.id;interactive.push(sprite);scene.add(sprite);}
 function inscription(lines,x,y,z,width=3.4){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=320;const ctx=canvas.getContext('2d');ctx.fillStyle='#16312e';ctx.fillRect(0,0,768,320);ctx.strokeStyle='#a7d6c1';ctx.strokeRect(9,9,750,302);ctx.textAlign='center';lines.forEach((line,i)=>{ctx.fillStyle=i?'#cbded7':'#b8e4ce';ctx.font=(i?'25':'34')+'px system-ui';ctx.fillText(line,384,67+i*57);});const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width*320/768),new THREE.MeshBasicMaterial({map}));mesh.position.set(x,y,z);scene.add(mesh);}
 // House and garden: thin geometric floors, framed full-height glazing, an open
 // central skylight. Static geometry is merged by material to bound draw calls.
 box(palette.soil,180,.35,180,0,-.45,0);box(palette.stone,35,.22,31,0,-.18,-2);
 for(const room of ROOMS){box(floor,7.9,.12,7.9,(room.bounds[0]+room.bounds[2])/2,-.02,(room.bounds[1]+room.bounds[3])/2);label(room);}
 box(palette.wood,24,.10,4.5,0,-.01,10.2);for(let i=-12;i<=12;i++)box(palette.darkWood,.018,.012,4.5,i,.05,10.2);
 // Solid lower outer wall, glass above, posts at a regular architectural rhythm.
 for(const x of [-12,12]){box(palette.trim,.18,.45,16,x,.225,0);box(palette.glass,.055,2.55,15.8,x,1.75,0);for(let z=-8;z<=8;z+=2)box(palette.bronze,.10,3.2,.10,x,1.6,z);box(palette.bronze,.11,.09,16,x,3.13,0);}
 box(palette.trim,32,.45,.18,0,.225,-16);box(palette.glass,31.9,2.55,.055,0,1.75,-16);for(let x=-16;x<=16;x+=2)box(palette.bronze,.10,3.2,.10,x,1.6,-16);
 for(const x of [-16,16]){box(palette.trim,.18,.45,8,x,.225,-12);box(palette.glass,.055,2.55,7.9,x,1.75,-12);for(let z=-16;z<=-8;z+=2)box(palette.bronze,.1,3.2,.1,x,1.6,z);}
 for(const sign of [-1,1]){box(palette.trim,10.6,.45,.18,sign*6.75,.225,8);box(palette.glass,10.5,2.55,.055,sign*6.75,1.75,8);for(let x=2;x<=12;x+=2)box(palette.bronze,.1,3.2,.1,sign*x,1.6,8);}
 box(palette.bronze,24,.1,.12,0,3.13,8);box(palette.bronze,.1,3.2,.1,-1.5,1.6,8);box(palette.bronze,.1,3.2,.1,1.5,1.6,8);
 for(const wall of WALLS){const [l,t,r,b]=wall,w=r-l,d=b-t,cx=(l+r)/2,cz=(t+b)/2;const outer=(w<.4&&(Math.abs(cx)===12||Math.abs(cx)===16))||(d<.4&&(Math.abs(cz-8)<.01||Math.abs(cz+16)<.01));if(outer)continue;box(palette.wall,w,3.1,d,cx,1.55,cz);box(palette.darkWood,w+.025,.12,d+.025,cx,.07,cz);box(palette.wood,w+.03,.08,d+.03,cx,3.1,cz);}
 for(const room of ROOMS){const panel=new THREE.Mesh(new THREE.BoxGeometry(7.95,.08,7.95),palette.white);panel.position.set((room.bounds[0]+room.bounds[2])/2,3.2,(room.bounds[1]+room.bounds[3])/2);panel.receiveShadow=true;ceilings.add(panel);}
 // Keep a genuine skylight in the central lounge/observatory.
 ceilings.children.filter((_,i)=>i===0||i===5).forEach(mesh=>mesh.visible=false);
 for(const room of ROOMS)for(const x of [-1.5,1.5]){const cx=(room.bounds[0]+room.bounds[2])/2,cz=(room.bounds[1]+room.bounds[3])/2;cyl(palette.white,.24,.24,.045,cx+x,3.08,cz,20);}
 // Lounge: the Atlas eye/orbit is a 3D object, surrounded by a low conversation area.
 box(palette.rug,4.4,.025,3.6,0,.06,3.8);box(palette.sofa,2.75,.4,.95,1.05,.42,6.2);box(palette.sofa,2.75,.6,.19,1.05,.75,6.6);box(palette.sofa,.18,.57,.95,-.25,.62,6.2);box(palette.sofa,.18,.57,.95,2.35,.62,6.2);obstacle(1.05,6.2,2.8,1.05);
 box(palette.wood,1.5,.1,.8,-.8,.48,4.6);box(palette.black,.07,.44,.07,-1.3,.24,4.6);box(palette.black,.07,.44,.07,-.3,.24,4.6);obstacle(-.8,4.6,1.5,.8);
 cyl(palette.stone,.64,.73,.6,0,.34,2.3,32);cyl(palette.gold,.65,.65,.04,0,.66,2.3,32);obstacle(0,2.3,1.3,1.3);
 const orb=new THREE.Group();orb.position.set(0,1.43,2.3);scene.add(orb);const core=new THREE.Mesh(new THREE.SphereGeometry(.32,30,22),palette.glow);orb.add(core);
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.61+i*.08,.012,6,64),palette.gold);ring.rotation.set(i*.7,.5+i*.8,.2);orb.add(ring);}animated.push({type:'orb',object:orb});
 // Γ is an organising symbol from the recovered Atlas language, not a claim of
 // consciousness: Animal/Mente/Suceso meet around the observation centre.
 const vertices=[new THREE.Vector3(-.9,.92,2.3),new THREE.Vector3(.9,.92,2.3),new THREE.Vector3(0,2.48,2.3)];
 for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3],edge=new THREE.CylinderGeometry(.012,.012,a.distanceTo(b),6);edge.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));edge.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);add(edge,palette.bronze);ball(palette.glow,.065,a.x,a.y,a.z);}
 inscription(['Γ / CENTRO','Animal · Mente · Suceso'],0,.78,2.8,1.9);
 plant(-3.2,6.8,1.4);plant(3.1,1.1,1.0);
 // Music studio: piano keys, acoustic slats, monitors, nearfield speakers, guitar.
 desk(-10.3,4,Math.PI/2);monitor(-10.1,4,Math.PI/2,palette.glow);chair(-8.9,4,Math.PI/2);box(palette.black,.8,.16,2.45,-9.95,.96,4);
 for(let i=0;i<24;i++){box(palette.white,.48,.025,.088,-9.55,1.06,2.9+i*.094);if(![2,6].includes(i%7))box(palette.black,.25,.045,.042,-9.68,1.09,2.94+i*.094);}
 for(const z of [2.7,5.3]){box(palette.black,.4,.6,.35,-10.5,1.14,z);ball(palette.bronze,.13,-10.26,1.14,z,.35,1,1);}
 for(let z=.65;z<7.7;z+=.22)box(palette.wood,.12,2.5,.065,-11.8,1.7,z);
 box(palette.darkWood,1.9,.13,.85,-6.1,.8,6.8);for(let i=0;i<10;i++)box(i%3?palette.black:palette.gold,.11,.04,.44,-6.8+i*.15,.89,6.8);
 ball(palette.gold,.28,-5.4,.82,1.2,.75,1.2,.26);box(palette.wood,.08,1.05,.06,-5.4,1.5,1.2);box(palette.black,.12,.24,.08,-5.4,2.04,1.2);plant(-5.2,7,1.2);
 // Laboratory: island bench, sample glass, microscope and molecule sculpture.
 desk(-10.1,-4,Math.PI/2);monitor(-10,-4,Math.PI/2,palette.blue);chair(-8.8,-4,Math.PI/2);
 box(palette.white,2.25,.85,.75,-8.2,.47,-6.3);box(palette.stone,2.4,.09,.9,-8.2,.94,-6.3);obstacle(-8.2,-6.3,2.5,1.0);
 for(let i=0;i<6;i++){cyl(palette.glass,.065,.085,.35,-9+i*.25,1.16,-6.3,12);cyl(palette.blue,.063,.073,.14,-9+i*.25,1.07,-6.3,12);}
 box(palette.black,.24,.12,.43,-7.6,1.05,-6.2);cyl(palette.white,.06,.08,.45,-7.6,1.32,-6.2,12);box(palette.black,.3,.1,.08,-7.5,1.5,-6.2,Math.PI/3);
 const molecule=new THREE.Group();molecule.position.set(-6.2,1.45,-5.9);scene.add(molecule);for(let i=0;i<7;i++){const sphere=new THREE.Mesh(new THREE.SphereGeometry(i? .11:.18,12,10),i%2?palette.blue:palette.white);sphere.position.set(Math.sin(i*2.4)*.5,Math.cos(i*1.8)*.38,Math.sin(i)*.3);molecule.add(sphere);}animated.push({type:'molecule',object:molecule});plant(-10.8,-1.0,1.2);
 // World workshop: creation table and small floating architectural maquette.
 desk(10.1,4,-Math.PI/2);monitor(10,4,-Math.PI/2,palette.violet);chair(8.8,4,-Math.PI/2);
 box(palette.darkWood,2.3,.13,1.6,7.5,.85,6.5);for(const x of [-.95,.95])box(palette.black,.08,.8,1.2,7.5+x,.4,6.5);obstacle(7.5,6.5,2.4,1.6);
 // The workshop maquette and terrace intervention are supplied by Atlas's latest validated 3D experience.
 box(palette.black,.08,1.75,2.4,11.7,1.55,1.8);for(let i=0;i<4;i++)box(palette.glow,.1,.025,1.9,11.62,1.0+i*.35,1.8);plant(5.2,1.0,1.2);
 // Cinema: wall screen, upholstered seats and projector.
 box(palette.black,.12,2.35,5.8,11.65,1.8,-4);box(palette.blue,.025,2.08,5.5,11.55,1.8,-4);box(palette.darkWood,.4,.2,6.3,11.1,.18,-4);
 for(const x of [6.5,8.2])for(const z of [-2.6,-4.3,-6]){chair(x,z,-Math.PI/2,palette.darkWood);box(palette.darkWood,.11,.3,.7,x,.62,z+.3);}
 cyl(palette.black,.18,.18,.07,5.1,2.6,-4);box(palette.black,.37,.2,.42,5.1,2.45,-4);ball(palette.glow,.075,5.31,2.45,-4,.3,1,1);plant(5.0,-7.0,1.1);
 // Observatory: subtle constellations, an astronomical globe and quiet desks.
 box(palette.black,6.6,2.3,.08,0,1.7,-7.7);
 const starMat=material('#dce8f0',{emissive:'#b9d8e7',emissiveIntensity:.9});for(let i=0;i<52;i++)ball(starMat,.018+random()*.016,-3+random()*6,.7+random()*1.9,-7.62,1,1,.4);
 const globe=new THREE.Group();globe.position.set(0,1.45,-5.5);scene.add(globe);globe.add(new THREE.Mesh(new THREE.SphereGeometry(.48,24,16),new THREE.MeshStandardMaterial({color:'#4a7186',roughness:.45,metalness:.2,wireframe:true,emissive:'#234d64',emissiveIntensity:.35})));
 for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.68+i*.07,.012,6,64),palette.bronze);ring.rotation.x=Math.PI/2+i*.7;globe.add(ring);}animated.push({type:'globe',object:globe});cyl(palette.wood,.35,.55,.85,0,.48,-5.5,24);obstacle(0,-5.5,1.3,1.3);
 for(const sign of [-1,1]){desk(sign*2.3,-6.5,0);box(palette.white,.42,.025,.35,sign*2.3,.92,-6.5);chair(sign*2.3,-5.5,0);}plant(-3.2,-1.2,1.2);plant(3.2,-1.2,1.2);
 // The archive cabinets resolve scoped user memory; books remain its visual representation.
 for(const x of [-14.8,-13.5]){box(palette.darkWood,1.05,2.45,.48,x,1.25,-14.8);for(let shelf=0;shelf<4;shelf++){box(palette.wood,1,.05,.53,x,.45+shelf*.55,-14.8);for(let j=0;j<5;j++)box([palette.blue,palette.white,palette.gold][j%3],.12,.36,.32,x-.38+j*.18,.66+shelf*.55,-14.74);}}
 desk(-10,-14.7);monitor(-10,-14.65,0,palette.blue);chair(-10,-13.6);plant(-14.7,-9,1.1);inscription(['MENTE / ATLAS','Observar · distinguir · conectar','Conservar evidencia y procedencia'],-12,2.0,-15.72,4.8);
 // Animal/Ion: hardware constraints and bounded actions, without implying that
 // a physical printer or robot is connected to this computer.
 desk(-5.6,-14.8);box(palette.black,.75,1.25,.55,-6.2,1.5,-14.8);for(let j=0;j<4;j++)box(palette.glow,.56,.045,.015,-6.2,1.15+j*.19,-14.51);box(palette.bronze,.75,.025,.42,-4.85,.94,-14.8);
 box(palette.stone,1.3,.12,1.3,-1.6,.7,-14.2);cyl(palette.bronze,.16,.24,.42,-1.6,.95,-14.2);box(palette.white,.20,.68,.20,-1.6,1.37,-14.2,-.3);box(palette.gold,.58,.16,.16,-1.33,1.7,-14.2,.2);obstacle(-1.6,-14.2,1.5,1.5);inscription(['ANIMAL / ION','Recursos · límites · consecuencias','Actuar, comprobar, recuperar'],-4,2.1,-15.72,4.8);
 // Refutation separates the candidate, test gate and the retained version.
 for(const x of [1.6,6.4]){box(palette.darkWood,1.5,.12,1.2,x,.8,-14.4);box(palette.white,.6,.65,.6,x,1.18,-14.4);obstacle(x,-14.4,1.6,1.3);}
 for(const x of [3.1,4.9])box(palette.bronze,.10,2,.12,x,1.0,-14.6);box(palette.gold,1.9,.10,.12,4,2.0,-14.6);inscription(['REFUTACIÓN','Candidato → prueba → decisión','Un fallo conserva la versión anterior'],4,2.1,-15.72,5.4);
 // Actual recovered LOR symbols are shown as notation. Interpretation and
 // execution live in the validated policy layer, not in this decorative board.
 inscription(['LOR-ΩΣ','S* = ⟨O,A,X,R,T,I,C,E,M,P,F,Σ⟩','Γ(t) = ⟨Animal(t), Mente(t), Suceso(t), Realidad(t)⟩'],12,2.0,-15.72,6.1);
 for(const x of [9.5,12,14.5]){cyl(palette.stone,.36,.42,.55,x,.31,-14.4,16);ball(x===12?palette.glow:palette.violet,.23,x,.95,-14.4);obstacle(x,-14.4,.85,.85);}
 plant(14.8,-9.1,1.0);
 // Garden, reflecting pool and distant silhouette: all lightweight geometry.
 box(palette.stone,5,.15,1.6,-7,.05,10.5);box(palette.glass,4.7,.05,1.3,-7,.15,10.5);for(const x of [-12,-3,12.5,15.5])plant(x,11.4,1.3);
 for(let i=0;i<22;i++){const a=i*.91,x=Math.sin(a)*(19+random()*12),z=Math.cos(a)*(20+random()*14);cyl(palette.wood,.12,.18,2.2,x,1,z);ball(i%2?palette.green:palette.leaf,1.2,x,3,z,1,1.45,1);}
 // Functional hit volumes bind existing furniture to real application tools.
 for(const fn of HOUSE_FUNCTIONS){const size=fn.hitSize||fn.size||(fn.kind==='cabinet'?[1.08,2.5,.58]:[1.6,1.4,.85]);const hit=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.set(...fn.position);hit.userData.functionId=fn.id;hit.userData.room=fn.room;interactive.push(hit);scene.add(hit);if(fn.kind==='cabinet')solids.push([fn.position[0]-.56,fn.position[2]-.31,fn.position[0]+.56,fn.position[2]+.31]);}
 // Commit each material group as one draw call. Geometry no longer needed after
 // merging is explicitly released; dynamic parts remain separate and cheap.
 for(const [mat,geometries] of batches){const merged=mergeGeometries(geometries,false);for(const geometry of geometries)geometry.dispose();const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=!mat.transparent;mesh.receiveShadow=!mat.transparent;statics.add(mesh);}
 const hemi=new THREE.HemisphereLight('#eef4ee','#777a69',.8);scene.add(hemi);const sun=new THREE.DirectionalLight('#fff0d5',3.0);sun.position.set(-15,25,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.target.position.set(0,0,0);scene.add(sun,sun.target);
 for(const [x,z] of [[-11,-12],[4,-12]]){const fill=new THREE.PointLight('#ffe4bd',18,12,2);fill.position.set(x,2.8,z);scene.add(fill);}
 const creatures=createProcessCreatures(scene,textures,{walls:solids}),installation=createCreativeInstallation(scene),living=createLivingInstallation(scene);let disposed=false;
 return {components,setPeopleBudget:value=>creatures.setPeopleBudget(value),setPeopleDetail:value=>creatures.setPeopleDetail(value),peopleStatus:()=>creatures.peopleStatus(),activateLiving:room=>living.activate(room),livingInteractionStatus:()=>living.interactionStatus(),setLivingState:value=>{living.setState(value);creatures.setLivingState(value);},livingStatus:()=>living.status(),scene,ceilings,interactive,solids,sun,residentPosition:id=>creatures.positionForResident(id),setProcessState:value=>creatures.setState(value),setCreativeState:value=>installation.setState(value),creativeStatus:()=>installation.status(),update(time,camera,viewportHeight){creatures.update(time,camera,viewportHeight);living.update(time);if(camera)for(const marker of interactive)if(!marker.userData.functionId)marker.visible=camera.position.y>3.5;for(const entry of animated){if(entry.type==='orb'){entry.object.rotation.y=time*.11;entry.object.position.y=1.43+Math.sin(time*.7)*.045;}else entry.object.rotation.y=time*(entry.type==='globe'?.055:.14);}},dispose(){if(disposed)return;disposed=true;creatures.dispose();installation.dispose();living.dispose();const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.isInstancedMesh)object.dispose();if(object.geometry)geometries.add(object.geometry);if(object.material)for(const mat of Array.isArray(object.material)?object.material:[object.material])materials.add(mat);});for(const geometry of geometries)geometry.dispose();for(const mat of materials)mat.dispose();for(const map of textures)map.dispose();scene.clear();}};
}
