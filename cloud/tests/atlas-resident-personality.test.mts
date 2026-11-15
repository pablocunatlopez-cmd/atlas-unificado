import test from 'node:test';import assert from 'node:assert/strict';
import {residentPersonality,designTeamMemories} from '../lib/cloud/resident-personality.ts';
test('specialists develop from scoped current criteria without borrowing another character’s data',()=>{
 const m=(scope:string,text:string,status='Confirmado')=>({scope,title:'Criterio',text,status,kind:'Regla'});
 const content=JSON.stringify({memories:[m('resident:games-desk','TALO_CURRENT: puertas anchas.'),m('resident:music-console','NOA_PRIVATE: música suave.'),m('resident:games-desk','TALO_OLD: tapa las puertas.','Retirado')]});
 const talo=residentPersonality('games-desk',content)!;assert.match(talo.temperament,/constructor/);assert.equal(talo.principles.length,1);assert.match(talo.principles[0].text,/TALO_CURRENT/);assert.equal(residentPersonality('unknown',content),null);
 const team=designTeamMemories(content,'Construir una casa');assert.match(JSON.stringify(team),/TALO_CURRENT/);assert.doesNotMatch(JSON.stringify(team),/NOA_PRIVATE|TALO_OLD/);assert.equal(new Set(team.map(m=>m.scope)).size,3);
});
