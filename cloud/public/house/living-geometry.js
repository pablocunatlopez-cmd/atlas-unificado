import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

export const LIVING_SHAPES=Object.freeze(['box','sphere','cylinder','torus','arch','helix','crystal','wave','bloom']);
const join=parts=>{const sources=parts.map(part=>part.index?part.toNonIndexed():part),merged=mergeGeometries(sources,false);for(const part of new Set([...parts,...sources]))part.dispose();if(!merged)throw Error('No se pudo construir la geometría.');return merged;};
function normalize(geometry){
 geometry.computeBoundingBox();const bounds=geometry.boundingBox,centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(extent)||extent<=0){geometry.dispose();throw Error('Geometría sin volumen válido.');}
 geometry.translate(-centre.x,-centre.y,-centre.z);geometry.scale(1/extent,1/extent,1/extent);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
class Helix extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const a=t*Math.PI*4;return target.set(Math.cos(a)*.28,t*.88-.44,Math.sin(a)*.28);}}
function wave(){
 const columns=24,rows=12,vertices=[],indices=[];
 for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){const x=column/columns-.5,z=(row/rows-.5)*.7,y=Math.sin(column/columns*Math.PI*3)*Math.cos(row/rows*Math.PI)*.14;vertices.push(x,y,z);}
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){const a=row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function createLivingGeometry(shape){
 if(!LIVING_SHAPES.includes(shape))throw Error('Forma no admitida.');
 if(shape==='box')return new THREE.BoxGeometry(1,1,1);
 if(shape==='sphere')return new THREE.SphereGeometry(.5,16,10);
 if(shape==='cylinder')return new THREE.CylinderGeometry(.45,.45,1,16);
 if(shape==='torus')return new THREE.TorusGeometry(.38,.08,8,24);
 let geometry;
 if(shape==='arch')geometry=join([new THREE.TorusGeometry(.36,.055,6,28,Math.PI).translate(0,.08,0),new THREE.CylinderGeometry(.055,.055,.52,8).translate(-.36,-.18,0),new THREE.CylinderGeometry(.055,.055,.52,8).translate(.36,-.18,0)]);
 if(shape==='helix')geometry=new THREE.TubeGeometry(new Helix(),64,.035,6,false);
 if(shape==='crystal')geometry=join([new THREE.OctahedronGeometry(1,0).scale(.18,.47,.18),new THREE.OctahedronGeometry(1,0).scale(.11,.29,.11).rotateZ(-.35).translate(-.23,-.15,.04),new THREE.OctahedronGeometry(1,0).scale(.10,.25,.10).rotateZ(.4).translate(.23,-.16,-.02),new THREE.OctahedronGeometry(1,0).scale(.09,.19,.09).rotateX(.5).translate(.04,-.23,.22)]);
 if(shape==='wave')geometry=wave();
 if(shape==='bloom'){
  const parts=[new THREE.SphereGeometry(.13,8,6)];
  for(let i=0;i<6;i++){const angle=i*Math.PI/3;parts.push(new THREE.SphereGeometry(1,8,6).scale(.13,.27,.065).translate(0,.25,.02).rotateZ(angle));}
  geometry=join(parts);
 }
 return normalize(geometry);
}
