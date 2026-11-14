import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLivingProposal} from '../public/house/living-contract.js';
import {measureLivingClearance,proposeLivingExperiment,LIVING_LAB_CANDIDATES} from '../lib/evolution/living-lab.mjs';
const proposal=()=>({title:'Estudio de órbitas',goal:'Una composición musical suspendida.',colors:['#163b54','#67e8da','#f3be69'],objects:[{shape:'box',x:0,y:.2,z:0,size:.65,color:0},{shape:'sphere',x:0,y:.2,z:0,size:.6,color:1},{shape:'torus',x:.1,y:.6,z:.1,size:.4,color:2}],program:[{op:'rotate',target:0,speed:.5,amount:0},{op:'float',target:1,speed:.7,amount:.1},{op:'pulse',target:2,speed:.6,amount:.1}],music:{bpm:112,swing:.12,kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],bass:[0,4,8,12],notes:Array.from({length:16},(_,i)=>[36,43,39,46][i%4])},film:{rooms:['music','games'],seconds:8},walk:true});

test('a bounded spatial experiment improves overlapping envelopes while preserving authored content and input',()=>{
 const p=proposal(),snapshot=structuredClone(p),result=proposeLivingExperiment(p,'music',3);
 assert.deepEqual(p,snapshot);assert.equal(LIVING_LAB_CANDIDATES,64);assert.equal(result.measurement.improved,true);assert.ok(result.measurement.before<0);assert.ok(result.measurement.after>0);assert.ok(result.measurement.after-result.measurement.before>=.005);assert.equal(measureLivingClearance(result.proposal),result.measurement.after);
 assert.deepEqual(validateLivingProposal(result.proposal),result.proposal);
 for(const key of ['title','goal','music','film','program','colors','walk'])assert.deepEqual(result.proposal[key],p[key]);
 for(const [i,o] of result.proposal.objects.entries()){for(const key of ['shape','y','size','color'])assert.equal(o[key],p.objects[i][key]);assert.ok(o.x>=-1.5&&o.x<=1.5&&o.z>=-1.5&&o.z<=1.5);}
 assert.ok(result.changes.length>0&&result.changes.length<=8);assert.match(result.scope,/No mide belleza/);
});

test('single objects and the exact two-object maximum are retained rather than presented as progress',()=>{
 const p=proposal();p.objects=p.objects.slice(0,1);p.program=[];const single=proposeLivingExperiment(p,'games',0);assert.equal(single.measurement.improved,false);assert.equal(single.measurement.before,0);assert.equal(single.measurement.after,0);assert.deepEqual(single.changes,[]);assert.deepEqual(single.proposal,validateLivingProposal(p));
 const pair=proposal();pair.objects=pair.objects.slice(0,2);pair.objects[0].x=-1.5;pair.objects[0].z=-1.5;pair.objects[1].x=1.5;pair.objects[1].z=1.5;pair.program=pair.program.filter(p=>p.target<2);const result=proposeLivingExperiment(pair,'games',91);assert.equal(result.measurement.improved,false);assert.equal(result.measurement.before,result.measurement.after);assert.deepEqual(result.proposal,validateLivingProposal(pair));assert.deepEqual(result.changes,[]);
});

test('the measurement includes bounding-cube rotation radius, maximum pulse and vertical float sweep',()=>{
 const p=proposal();p.objects=p.objects.slice(0,2);p.program=[];p.objects[0].x=-1;p.objects[1].x=1;const basic=measureLivingClearance(p),expected=2-Math.sqrt(3)/2*(.65+.6);assert.ok(Math.abs(basic-expected)<1e-12);
 p.program=[{op:'pulse',target:0,speed:.5,amount:.1},{op:'float',target:1,speed:.5,amount:.08}];const swept=measureLivingClearance(p);assert.ok(Math.abs(swept-(basic-Math.sqrt(3)/2*.65*.1-.08))<1e-12);
 p.objects[1].y=.9;assert.ok(measureLivingClearance(p)>swept,'real y uses scene 0.32 scaling');
});

test('experiments are reproducible and never promote a worse score across bounded seeds and eight-object scenes',()=>{
 const p=proposal();p.objects=Array.from({length:8},(_,i)=>({...p.objects[i%3],x:(i%3)*.04,z:Math.floor(i/3)*.04}));
 for(let iteration=0;iteration<12;iteration++){
  const a=proposeLivingExperiment(p,'lab',iteration),b=proposeLivingExperiment(p,'lab',iteration);assert.deepEqual(a,b);assert.ok(a.measurement.after>=a.measurement.before);assert.equal(a.measurement.improved,a.measurement.after-a.measurement.before>=.005);assert.equal(a.proposal.objects.length,8);
 }
});

test('invalid contracts, rooms, precision and iteration inputs are rejected before search',()=>{
 for(const iteration of [-1,.5,NaN,Infinity,1e9+1,'1'])assert.throws(()=>proposeLivingExperiment(proposal(),'music',iteration),/ITERATION/);
 for(const room of ['unknown',undefined,'__proto__'])assert.throws(()=>proposeLivingExperiment(proposal(),room,0),/ROOM/);
 const p=proposal();p.objects[0].size=2;assert.throws(()=>proposeLivingExperiment(p,'music',0));p.objects[0].size=.5;p.program[0].amount=.5;assert.throws(()=>proposeLivingExperiment(p,'music',0));assert.throws(()=>measureLivingClearance({}));
});
