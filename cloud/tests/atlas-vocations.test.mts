import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {VOCATIONS,VOCATION_PROCESSES,vocationFor} from '../lib/collaboration/vocations.ts';
import {RESIDENTS} from '../public/house/residents.js';
import {publicUrl} from '../lib/research/web.ts';
const residents=RESIDENTS as readonly {id:string;cosmetic:boolean}[];

test('every resident, including all six spectators, has a distinct vocation',()=>{
 assert.equal(VOCATIONS.length,24);assert.equal(new Set(VOCATIONS.map(v=>v.residentId)).size,24);
 assert.deepEqual(new Set(VOCATIONS.map(v=>v.residentId)),new Set(residents.map(r=>r.id)));
 assert.equal(residents.filter(r=>r.cosmetic).every(r=>vocationFor(r.id)),true);
 assert.equal(vocationFor('resident:music-console')?.domain,'composition');assert.equal(vocationFor('missing'),undefined);
});
test('work spans specialties instead of routing every resident to graphics',()=>{
 assert.ok(new Set(VOCATIONS.map(v=>v.domain)).size>=20);assert.equal(VOCATIONS.filter(v=>v.focus==='3d').length,2);
 assert.equal(vocationFor('music-mixer')?.domain,'mixing');assert.equal(vocationFor('mind-desk')?.domain,'memory');
 assert.equal(vocationFor('language-meaning')?.domain,'interpretation');assert.equal(vocationFor('cinema-audience-5')?.domain,'accessibility');
 for(const v of VOCATIONS){assert.equal(v.processId,VOCATION_PROCESSES[v.focus]);assert.ok(v.question.endsWith('?'));assert.ok(v.application.length>25);assert.ok(v.validation.length>=2);}
});
test('source candidates are official HTTPS references from the public reader catalog',()=>{
 for(const v of VOCATIONS){assert.ok(v.sources.length>=2);for(const s of v.sources){assert.equal(publicUrl(s.url),s.url);assert.ok(s.title.length>8);}}
});
test('application targets are explicit, relative and existing for Atlas; ERAS paths await inspection',()=>{
 for(const v of VOCATIONS){assert.ok(['atlas','eras'].includes(v.targetProject));if(v.targetProject==='atlas')assert.ok(v.targetFiles.length>0);for(const file of v.targetFiles){assert.ok(!file.startsWith('/')&&!file.split('/').includes('..'));if(v.targetProject==='atlas')assert.ok(existsSync(file),file);}}
});
