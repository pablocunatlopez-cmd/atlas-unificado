import * as THREE from './vendor/three.module.js';
import {validateSceneDocument} from './scene-document.js';

/** Build real ERAS/Three meshes. Size fields keep Atlas' SEMIAXES convention. */
export function buildErasScene(raw){
 const document=validateSceneDocument(raw),scene=new THREE.Scene(),content=new THREE.Group();content.name='Lía / ERAS / proyecto';scene.add(content);
 const materials=document.materials.map((m,i)=>{const color=new THREE.Color(...m.color),material=new THREE.MeshStandardMaterial({color,roughness:m.roughness,metalness:m.metalness,emissive:color,emissiveIntensity:m.emission});material.name='Material '+(i+1);return material;});
 const geometries={box:new THREE.BoxGeometry(2,2,2),sphere:new THREE.SphereGeometry(1,24,16),cylinder:new THREE.CylinderGeometry(1,1,2,32),cone:new THREE.ConeGeometry(1,2,32)};
 let triangles=0;
 for(const object of document.objects){const geometry=geometries[object.type],mesh=new THREE.Mesh(geometry,materials[object.material]);mesh.name=object.name;mesh.position.set(...object.position);mesh.scale.set(...object.size);mesh.rotation.y=object.yaw;mesh.castShadow=true;mesh.receiveShadow=true;if(object.tag)mesh.userData.tag=object.tag;content.add(mesh);triangles+=(geometry.index?.count||geometry.attributes.position.count)/3;}
 const camera=new THREE.PerspectiveCamera(50,1,.08,1500);camera.position.set(...document.camera);camera.lookAt(...document.target);camera.updateMatrixWorld();
 const bounds=new THREE.Box3().setFromObject(content),extent=new THREE.Vector3();bounds.getSize(extent);const groundSize=Math.max(40,Math.min(320,Math.max(extent.x,extent.z)*2.4));
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(groundSize,groundSize),new THREE.MeshStandardMaterial({color:new THREE.Color(...document.materials[0].color),roughness:Math.max(.45,document.materials[0].roughness),metalness:document.materials[0].metalness*.3}));ground.name='Suelo ERAS';ground.rotation.x=-Math.PI/2;ground.position.y=-.006;ground.receiveShadow=true;scene.add(ground);
 return{document,scene,content,camera,bounds,triangles,objects:content.children.length};
}
export function disposeErasScene(scene){
 const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();scene.clear();return{geometries:geometries.size,materials:materials.size};
}
