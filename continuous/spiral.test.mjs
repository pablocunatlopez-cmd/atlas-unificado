import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {atlasFoundation,discoverFoundationImages,spiralRecord} from './spiral.mjs';

test('la semilla conserva sus prompts y el orden original del loop',()=>{
 assert.equal(atlasFoundation.id,'atlas-foundation-v1');
 assert.deepEqual(atlasFoundation.loop,['Observar','Comprender','Conectar','Aplicar','Refutar','Aprender']);
 assert.ok(atlasFoundation.prompts.some(prompt=>prompt.id==='spiral-continuity'));
 assert.equal(atlasFoundation.visualLanguage.organigram.status,'pendiente de mostrar por el usuario');
 assert.equal(atlasFoundation.visualLanguage.organigram.nodes,null);
 assert.equal(atlasFoundation.visualLanguage.organigram.insertImages,false);
});

test('el registro conserva el marcador del organigrama sin inventarlo ni afirmar comprensión visual',()=>{
 const record=spiralRecord({signature:'fixture',documents:[{url:'https://docs.example/a',hash:'abc',role:'train'}],result:{metrics:{accepted:false,before:1.2,after:1.3,candidateCount:2,attemptedStepsTotal:4,candidates:[]}},mandateHash:'mandate'});
 assert.deepEqual(record.stages.map(stage=>stage.stage),atlasFoundation.loop);
 assert.equal(record.foundationId,atlasFoundation.id);
 assert.equal(record.promptRefs.length,atlasFoundation.prompts.length);
 assert.equal(record.visualInputsUsedByModel,false);
 assert.match(record.stages[0].result,/organigrama Atlas permanece pendiente/);
 assert.equal(atlasFoundation.visualLanguage.organigram.nodes,null);
 assert.equal(record.accepted,false);
 assert.ok(record.negativeLesson);
});

test('el descubridor registra solo imágenes locales admitidas con SHA-256',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'atlas-foundation-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const assets=path.join(root,'foundation-assets');await mkdir(assets);
 await writeFile(path.join(assets,'seed.png'),Buffer.from([1,2,3,4]));
 await writeFile(path.join(assets,'ignore.txt'),'not an image');
 const result=await discoverFoundationImages(root);
 assert.equal(result.length,1);
 assert.equal(result[0].name,'seed.png');
 assert.equal(result[0].modelInput,false);
 assert.equal(result[0].sha256,'9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a');
});
