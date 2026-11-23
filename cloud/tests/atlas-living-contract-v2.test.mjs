import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLivingProposal,validateLivingState,livingPattern,LIVING_SHAPES,LIVING_STYLES,LIVING_FLOORS} from '../public/house/living-contract.js';
import {validatePattern} from '../lib/music/pattern.mjs';

const proposal=()=>({title:'Jardín de órbitas',goal:'Una estructura suspendida para presentar una composición propia.',colors:['#163b54','#67e8da','#f3be69'],objects:[{shape:'sphere',x:-1,y:0,z:0,size:.65,color:0},{shape:'torus',x:1,y:1,z:0,size:.65,color:1}],program:[{op:'rotate',target:0,speed:.5,amount:0},{op:'float',target:1,speed:.8,amount:.1},{op:'pulse',target:1,speed:.7,amount:.1}],music:{bpm:112,swing:.12,kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],bass:[0,4,8,12],notes:Array.from({length:16},(_,i)=>[36,43,39,46][i%4])},film:{rooms:['music','games'],seconds:8},walk:true});
const artifact=()=>({id:'living-'+('b'.repeat(24)),room:'music',actorId:'resident:music-console',actorName:'Noa',at:'2026-11-11T10:00:00.000Z',proposal:proposal()});
const receipt=()=>({parentId:'living-'+('a'.repeat(24)),metric:'Minimum animated separation',before:-.3,after:.45,at:'2026-11-11T12:00:00Z',changes:['Separated the two nearest objects']});
const state=a=>validateLivingState({artifacts:{music:a}}).artifacts.music;

test('existing v1 works retain their music, movement and labels with architectural defaults',()=>{
 const old=proposal(),checked=validateLivingProposal(old);
 assert.equal(checked.version,1);assert.deepEqual(checked.environment,{style:'gallery',floor:'grid',intensity:.45});
 for(const key of ['title','goal','objects','program','music','film','walk'])assert.deepEqual(checked[key],old[key]);
 assert.deepEqual(validatePattern(livingPattern(checked)),validatePattern(livingPattern(old)));
 const saved=state(artifact());assert.equal(saved.actorName,'Noa');assert.equal(saved.origin,undefined);assert.equal(saved.experiment,undefined);
 assert.deepEqual(validateLivingProposal(checked),checked,'canonical normalization is idempotent');
});

test('all supported shapes and architectural combinations are accepted within the old spatial envelope',()=>{
 for(const shape of LIVING_SHAPES)for(const style of LIVING_STYLES)for(const floor of LIVING_FLOORS){
  const raw=proposal();raw.objects[0]={shape,x:-1.5,y:0,z:1.5,size:.15,color:0};raw.objects[1]={shape,x:1.5,y:1,z:-1.5,size:.65,color:2};raw.environment={style,floor,intensity:.2};
  const checked=validateLivingProposal(raw);assert.equal(checked.objects[0].shape,shape);assert.deepEqual(checked.environment,{style,floor,intensity:.2});
  raw.environment.intensity=.8;assert.equal(validateLivingProposal(raw).environment.intensity,.8);
 }
});

test('new decoration is whitelisted without widening geometry, program, music or camera limits',()=>{
 const raw=proposal();raw.environment={style:'garden',floor:'rings',intensity:.6,script:'external()',url:'https://example.invalid/texture'};raw.objects[0].script='run';raw.onEnter={javascript:'eval()'};
 const checked=validateLivingProposal(raw);assert.deepEqual(checked.environment,{style:'garden',floor:'rings',intensity:.6});assert.equal('script' in checked.objects[0],false);assert.equal('onEnter' in checked,false);
 const invalid=[p=>p.environment=null,p=>p.environment={style:'castle',floor:'grid',intensity:.5},p=>p.environment={style:'arcade',floor:'remote',intensity:.5},p=>p.environment={style:'gallery',floor:'tiles',intensity:.19},p=>p.environment={style:'gallery',floor:'tiles',intensity:.81},p=>p.environment={style:'gallery',floor:'tiles',intensity:NaN},p=>p.objects[0].shape='custom-javascript',p=>p.objects[0].size=.651,p=>p.objects[0].x=1.51,p=>p.objects[0].y=1.01,p=>p.objects=Array(9).fill(p.objects[0]),p=>p.program[0].amount=.101,p=>p.program[0].speed=1.01,p=>p.program[0].target=2,p=>p.music.notes[0]=35,p=>p.music.bass=[0],p=>p.film.rooms=['outside'],p=>p.film.seconds=17];
 for(const mutate of invalid){const p=proposal();mutate(p);assert.throws(()=>validateLivingProposal(p));}
});

test('model and design-kit origins stay explicit, and experiments retain only bounded measurement provenance',()=>{
 for(const origin of ['model','design-kit']){const checked=state({...artifact(),origin,experiment:receipt(),url:'https://example.invalid'});assert.equal(checked.origin,origin);assert.equal(checked.experiment,undefined);assert.equal('url' in checked,false);}
 const kit=state({...artifact(),origin:'design-kit',parentId:receipt().parentId});assert.equal(kit.parentId,receipt().parentId);assert.equal(kit.experiment,undefined);
 assert.equal(state({...artifact(),origin:'design-kit',parentId:'bad'}).parentId,undefined);assert.equal(state({...artifact(),origin:'model',parentId:receipt().parentId}).parentId,undefined);
 const experimental={...artifact(),origin:'tool-experiment',experiment:{...receipt(),code:'run()',improved:true}};
 const checked=state(experimental);assert.equal(checked.origin,'tool-experiment');assert.deepEqual(checked.experiment,{...receipt(),at:'2026-11-11T12:00:00.000Z'});assert.equal('code' in checked.experiment,false);assert.equal('improved' in checked.experiment,false);
 experimental.experiment.changes[0]='mutated';assert.equal(checked.experiment.changes[0],'Separated the two nearest objects','normalized receipt owns its array');
 const noChanges=receipt();delete noChanges.changes;assert.equal('changes' in state({...artifact(),origin:'tool-experiment',experiment:noChanges}).experiment,false);
});

test('invalid experiment metadata is not trusted and never makes a valid legacy scene disappear',()=>{
 const invalid=[r=>r.parentId='other',r=>r.metric='',r=>r.metric='x'.repeat(81),r=>r.before=Infinity,r=>r.after=1e6+1,r=>r.at='not-a-date',r=>r.changes=[''],r=>r.changes=Array(9).fill('change'),r=>r.changes=['x'.repeat(161)],r=>r.changes='run()'];
 for(const mutate of invalid){const r=receipt();mutate(r);const checked=state({...artifact(),origin:'tool-experiment',experiment:r});assert.ok(checked);assert.equal(checked.origin,undefined);assert.equal(checked.experiment,undefined);}
 for(const raw of [{...artifact(),origin:'untrusted',experiment:receipt()},{...artifact(),experiment:receipt()}]){const checked=state(raw);assert.ok(checked);assert.equal(checked.origin,undefined);assert.equal(checked.experiment,undefined);}
 const bounded=receipt();bounded.before=-1e6;bounded.after=1e6;bounded.metric='m'.repeat(80);bounded.changes=Array(8).fill('c'.repeat(160));assert.ok(state({...artifact(),origin:'tool-experiment',experiment:bounded}).experiment);
});
