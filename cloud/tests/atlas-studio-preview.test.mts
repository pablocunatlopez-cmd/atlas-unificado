import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProject} from '../lib/studio/generator.ts';
import {studioPreviewMode} from '../lib/studio/preview-policy.ts';
import type {StudioProject} from '../lib/studio/types.ts';

function project(mode:StudioProject['mode']='3d'):StudioProject{
 const value=generateProject('Una escultura de oro',mode),at='2026-11-15T12:00:00Z';
 return{id:'5e3f73dc-e95f-4c12-988b-8bcd03586432',title:value.brief.title,mode,prompt:value.brief.prompt,brief:value.brief,code:value.code,revision:1,viewingVersion:1,createdAt:at,updatedAt:at,versions:[{version:1,date:at}]};
}
test('known generated 3D scenes and renders select ERAS without changing source',()=>{
 for(const mode of ['3d','image'] as const){const value=project(mode),source=value.code;assert.equal(studioPreviewMode(value,source),'eras');assert.equal(value.code,source);}
});
test('custom HTML metadata survives reopening even when its geometry resembles generated code',()=>{
 const value=project();value.brief={...value.brief,preview:'html'};assert.equal(studioPreviewMode(value,value.code),'html');
});
test('historical custom scripts and unsaved edits stay in their own HTML preview',()=>{
 const value=project(),custom=value.code.replace('</body>','<script>document.body.dataset.custom="saved"</script></body>');assert.notEqual(custom,value.code);
 assert.equal(studioPreviewMode({...value,code:custom},custom),'html');assert.equal(studioPreviewMode(value,custom),'html');
});
test('portable games and applications retain gameplay and code execution by default',()=>{
 for(const mode of ['game','code'] as const){const value=project(mode);value.brief.preview='eras';assert.equal(studioPreviewMode(value,value.code),'html');}
});
