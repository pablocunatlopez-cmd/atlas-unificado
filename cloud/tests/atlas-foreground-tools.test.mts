import test from 'node:test';
import assert from 'node:assert/strict';
import {performHouseTool} from '../lib/collaboration/foreground-tools.ts';
import {missionFor,MISSIONS} from '../lib/collaboration/missions.ts';
import {validatePattern} from '../lib/music/pattern.mjs';
const run=(id:string,previous?:{kind:string;value:any})=>performHouseTool(missionFor(id)!,previous);

test('Noa produces one editable deterministic music draft without mutating a prior project',()=>{
 const first=run('music-console');assert.equal(first.status,'applied');assert.equal(first.artifact?.kind,'music');const pattern=validatePattern(first.artifact!.value);
 assert.equal(pattern.bassNotes.length,16);assert.equal(pattern.tracks.kick.steps[0],true);assert.ok(first.checks.every(c=>c.passed));
 const before=JSON.stringify(first.artifact),again=run('music-console',first.artifact);assert.equal(again.status,'unchanged');assert.equal(again.changed,false);assert.equal(JSON.stringify(first.artifact),before);
 assert.deepEqual(run('music-console').artifact,first.artifact);
});
test('Ritmo actually removes DC and clipping from reproducible stereo samples and converges',()=>{
 const first=run('music-mixer'),v=first.artifact!.value;assert.equal(first.artifact?.kind,'audio');assert.ok(first.checks.every(c=>c.passed));
 assert.ok(v.before[0].clipped>0);assert.ok(Math.abs(v.before[0].mean)>.1);assert.equal(v.after[0].clipped,0);assert.ok(v.after[0].peak<=.94001);assert.ok(Math.abs(v.after[0].mean)<1e-6);
 assert.equal(v.channels.length,2);assert.equal(v.channels[0].length,128);assert.ok(v.channels[1].every((n:number,i:number)=>Math.abs(n-v.channels[0][i]*.5)<1e-6));
 assert.ok(JSON.stringify(first.artifact).length<24000);assert.equal(run('music-mixer',first.artifact).status,'unchanged');
 const invalid=run('music-mixer',{kind:'audio',value:{channels:[[NaN]],sampleRate:16000}});assert.equal(invalid.status,'waiting');assert.equal(invalid.changed,false);assert.equal(invalid.artifact,undefined);
});
test('Faro prepares a bounded actual camera script and rejects inconsistent scripts without pretending to record',()=>{
 const first=run('cinema-projector'),v=first.artifact!.value;assert.equal(first.artifact?.kind,'film');assert.equal(v.captureRequired,true);assert.ok(v.rooms.length<=4);assert.equal(v.shots.reduce((sum:number,s:{seconds:number})=>sum+s.seconds,0),v.seconds);assert.match(first.summary,/no se ha generado ni observado un vídeo/);
 assert.equal(run('cinema-projector',first.artifact).status,'unchanged');assert.equal(run('cinema-projector',{kind:'film',value:{...v,seconds:5}}).status,'waiting');assert.equal(run('cinema-projector',{kind:'film',value:{...v,rooms:['unknown']}}).status,'waiting');
});
test('Sigma retains the twelve original operators and actually executes contradiction and arithmetic checks',()=>{
 const first=run('language-symbol'),v=first.artifact!.value;assert.equal(first.artifact?.kind,'lor');assert.equal(v.fields.length,12);assert.equal(v.phases.length,6);assert.equal(v.beneficiary,'lia');assert.ok(first.checks.some(c=>c.name==='Contradicciones visibles'&&c.passed));assert.ok(first.checks.some(c=>c.name==='No evalúa código'&&c.passed));assert.ok(first.checks.every(c=>c.passed));assert.equal(run('language-symbol',first.artifact).status,'unchanged');
});
test('image and software operators execute real measurements and library cases without claiming installed code',()=>{
 const seen=run('sense:image');assert.equal(seen.status,'tested');assert.equal(seen.artifact!.value.features.visiblePixels,3);assert.ok(seen.checks.every(c=>c.passed));
 const executed=run('body-console');assert.equal(executed.status,'tested');assert.deepEqual(executed.artifact!.value.execution.result,[[1,8]]);assert.equal(executed.artifact!.value.invalidRejected,true);assert.ok(executed.checks.every(c=>c.passed));assert.equal(run('body-console',executed.artifact).status,'unchanged');
});
test('conversation and research contracts distinguish candidate URLs from read evidence',()=>{
 const convo=run('salon-centre'),research=run('lab-desk');assert.equal(convo.artifact?.kind,'conversation');assert.equal(research.artifact?.kind,'research');
 for(const result of [convo,research]){assert.equal(result.status,'tested');assert.equal(result.needsEngineering,true);assert.equal(result.artifact!.value.beneficiary,'lia');assert.ok(result.artifact!.value.references.every((r:{status:string})=>r.status==='candidate-not-read'));assert.ok(result.checks.every(c=>c.passed));}
 assert.equal(run('lab-desk',research.artifact).status,'unchanged');
});
test('all registered jobs stay bounded and unsupported game or weight work remains an engineering task',()=>{
 for(const mission of MISSIONS){const result=performHouseTool(mission);assert.ok(['applied','tested','waiting'].includes(result.status),mission.id);if(result.artifact)assert.ok(JSON.stringify(result.artifact).length<24000,mission.id);if(result.status==='waiting'){assert.equal(result.changed,false);assert.equal(result.needsEngineering,true);}}
 assert.equal(run('eras-character:ice:warrior').status,'waiting');assert.equal(run('games-desk').artifact,undefined);assert.equal(run('process:weights').status,'waiting');
});
