import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProject} from '../lib/studio/generator.ts';
import {buildScene,type StudioMode} from '../lib/studio/scene.ts';
import {studioRebuildOptions,StudioRedesignRequiredError} from '../lib/studio/rebuild.ts';

const prompt='Una casa azul con una escultura propia';
const plan={version:2,title:'Casa diseñada',variant:'architecture',lighting:'sunset',palette:'Azul',objects:[{name:'Escultura propia',type:'cone',position:[4,1,0],size:[1,1,1],material:12,yaw:.4}],materials:[{color:[.2,.3,.8],roughness:.45,metalness:.3,emission:0}],camera:[12,8,10],target:[2,1,0],design:'Una composición propia; no añadir la casa de la plantilla.'};
function authored(){const generated=generateProject(prompt,'3d',{plan});return{...generated,prompt,mode:'3d' as const};}

test('rebuilding an AI scene changes configuration without replacing its geometry or materials with a preset',()=>{
 const previous=authored(),before=structuredClone(previous.brief),options=studioRebuildOptions({prompt,mode:'3d',lighting:'night',palette:'Oro',seed:42,quality:'high'},previous);
 const rebuilt=generateProject(prompt,'3d',options),scene=buildScene(rebuilt.brief),original=buildScene(previous.brief);
 assert.equal(rebuilt.brief.plan?.version,2);assert.deepEqual(scene.objects,original.objects);assert.deepEqual(scene.materials.slice(12),original.materials.slice(12));
 assert.deepEqual(scene.camera,original.camera);assert.deepEqual(scene.target,original.target);assert.equal(scene.objects.length,1);assert.equal(scene.objects[0].name,'Escultura propia');
 assert.equal(rebuilt.brief.lighting,'night');assert.equal(rebuilt.brief.palette,'Oro');assert.equal(rebuilt.brief.seed,42);assert.equal(rebuilt.brief.quality,'high');assert.deepEqual(previous.brief,before);
});
test('an unchanged rebuild keeps the complete authored brief and isolated options',()=>{
 const previous=authored(),options=studioRebuildOptions({prompt:'  '+prompt+'  ',mode:'3d'},previous),rebuilt=generateProject(prompt,'3d',options);
 assert.deepEqual(rebuilt.brief.plan,previous.brief.plan);assert.equal(rebuilt.brief.seed,previous.brief.seed);assert.equal(rebuilt.brief.lighting,previous.brief.lighting);
 const objects=(options.plan as {objects:Array<{position:number[]}>}).objects;objects[0].position[0]=10;assert.equal(previous.brief.plan!.objects[0].position[0],4);
});
test('a new description or mode requires explicit AI redesign and preserves the previous project',()=>{
 const previous=authored(),before=structuredClone(previous);
 for(const input of [{prompt:'Un bosque distinto',mode:'3d' as StudioMode},{prompt,mode:'game' as StudioMode}]){
  assert.throws(()=>studioRebuildOptions(input,previous),(error:unknown)=>{assert.ok(error instanceof StudioRedesignRequiredError);assert.equal(error.code,'AI_REDESIGN_REQUIRED');assert.equal(error.href,input.mode==='game'?'/?room=games':'/?room=lab');assert.match(error.message,/versiones se conservan/);return true;});
 }
 assert.deepEqual(previous,before);
});
test('procedural projects still accept a new brief while legacy model plans remain model plans',()=>{
 const previous=generateProject('Un bosque','3d'),options=studioRebuildOptions({prompt:'Una galería',mode:'3d',seed:7},{...previous,prompt:'Un bosque',mode:'3d'});assert.deepEqual(options,{seed:7});assert.equal(generateProject('Una galería','3d',options).brief.variant,'gallery');
 const legacy=generateProject(prompt,'3d',{plan:{...plan,version:1,objects:[{type:'box',position:[4,1,0],size:[1,1,1],material:2,yaw:0}]}}),legacySource={...legacy,prompt,mode:'3d' as const};
 const rebuilt=generateProject(prompt,'3d',studioRebuildOptions({prompt,mode:'3d',lighting:'night'},legacySource));assert.equal(rebuilt.brief.plan?.version,1);assert.deepEqual(rebuilt.brief.plan?.objects,legacy.brief.plan?.objects);assert.equal(rebuilt.brief.lighting,'night');
});
