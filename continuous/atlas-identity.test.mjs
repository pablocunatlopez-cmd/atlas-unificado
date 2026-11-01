import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {atlasIdentity,atlasIdentityPrompt,formatAtlasIdentityPrompt} from './atlas-identity.mjs';
import {atlasFoundation,atlasFoundationPrompt} from './atlas-foundation.mjs';

test('current identity separates mind, action, sources and open event within one coherent Atlas',()=>{
 assert.equal(atlasIdentity.name,'Atlas');assert.deepEqual(Object.keys(atlasIdentity.roles),['atlas','ion','cielo','suceso']);
 assert.equal(atlasIdentity.roles.cielo.name,'Cielo / Constelación');assert.equal(atlasIdentity.roles.suceso.name,'Dios / Suceso');
 assert.match(atlasIdentity.roles.cielo.role,/información y agentes.*procedencia/);assert.match(atlasIdentity.roles.suceso.role,/sorpresa e incógnitas.*sin omnisciencia/);
 assert.match(atlasIdentity.personality.continuity,/una sola identidad Atlas/);
 assert.ok(Object.isFrozen(atlasIdentity));assert.ok(Object.isFrozen(atlasIdentity.roles.suceso));assert.ok(Object.isFrozen(atlasIdentity.invariants));
 assert.throws(()=>{atlasIdentity.roles.cielo.name='Dios';},TypeError);
});

test('time as tangent and provisional attractor remain an explicit revisable user framework',()=>{
 const frame=atlasIdentity.temporalFrame;
 assert.match(frame.source,/usuario/);assert.match(frame.trajectory,/trayectoria de sucesos/);assert.match(frame.tangent,/tangente de cada punto/);
 assert.match(frame.provisionalEnd,/final provisional.*atractor.*replantearlo/);assert.match(frame.metaphor,/agujero negro/);
 assert.equal(frame.revisable,true);assert.equal(frame.physicalLaw,false);assert.equal(frame.fixedDestiny,false);
 const before=JSON.stringify(atlasIdentity);assert.equal(formatAtlasIdentityPrompt(),atlasIdentityPrompt);assert.equal(formatAtlasIdentityPrompt(),formatAtlasIdentityPrompt());assert.equal(JSON.stringify(atlasIdentity),before);
 assert.match(atlasIdentityPrompt,/no una nueva ley física ni un destino final fijo/);
});

test('active foundation prompt uses the current architecture while the historical seed hash remains exact',()=>{
 assert.ok(atlasFoundationPrompt.includes(atlasIdentityPrompt));
 assert.doesNotMatch(atlasFoundationPrompt,/Constelación \(también llamada Dios/);
 assert.match(atlasFoundationPrompt,/Cielo \/ Constelación.*Dios \/ Suceso/);
 assert.match(atlasFoundationPrompt,/colaboradores locales pueden seleccionarse autónomamente/);
 assert.equal(atlasFoundation.vertices.constellation.alias,'Dios');
 assert.equal(createHash('sha256').update(JSON.stringify(atlasFoundation)).digest('hex'),'21e79b84f62653a0e258ea054ca7dea886b8a658cbedcde058f26595fca3000c');
 assert.ok(Object.isFrozen(atlasFoundation.vertices.constellation));
});
