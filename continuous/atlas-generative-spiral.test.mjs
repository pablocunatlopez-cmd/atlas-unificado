import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateAtlasTangentSpirals} from '../cloud/public/house/atlas-generative-spiral.js';
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('branch births coincide with a point on their parent',()=>{
 const result=generateAtlasTangentSpirals({depth:3,budget:20,samples:64});
 assert.ok(result.branches.length>3);
 assert.ok(result.branches.length<=20);
 for(const child of result.branches.filter(b=>b.parent!==null)){
  const parent=result.branches.find(b=>b.id===child.parent);
  assert.ok(parent);
  assert.ok(parent.points.some(p=>dist(p,child.points[0])<1e-9));
 }
 assert.equal(result.events.length,result.branches.length);
 assert.equal(result.vertices[2],'Dios/Suceso');
});
test('offspring initial heading approximates parent tangent',()=>{
 const r=generateAtlasTangentSpirals({depth:1,budget:3,samples:128});
 for(const child of r.branches.filter(b=>b.parent!==null)){
  const parent=r.branches.find(b=>b.id===child.parent);
  const index=parent.points.findIndex(p=>dist(p,child.points[0])<1e-9);
  const tangent=parent.points[index+1].map((v,j)=>v-parent.points[index-1][j]);
  const initial=child.points[1].map((v,j)=>v-child.points[0][j]);
  const dot=tangent.reduce((sum,v,j)=>sum+v*initial[j],0)/(Math.hypot(...tangent)*Math.hypot(...initial));
  assert.ok(dot>.99);
 }
});
test('strict resource and parameter bounds prevent unbounded generation',()=>{
 const r=generateAtlasTangentSpirals({depth:6,budget:5});
 assert.equal(r.branches.length,5);
 assert.equal(r.remainingBudget,0);
 assert.throws(()=>generateAtlasTangentSpirals({depth:100}));
 assert.throws(()=>generateAtlasTangentSpirals({budget:100000}));
 assert.throws(()=>generateAtlasTangentSpirals({growthRate:Infinity}));
});
