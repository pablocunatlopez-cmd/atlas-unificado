import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPersonalMemories} from '../lib/cloud/personal-context.ts';
test('saved preferences survive, relevant facts selected, retired versions excluded',()=>{
 const content=JSON.stringify({memories:[
  {title:'Coste',text:'Sin coste y sin PC.',kind:'Regla',status:'Confirmado',date:'2026-11-15'},
  {title:'Antiguo',text:'Contrata servidores caros',kind:'Regla',status:'Retirado'},
  {title:'Música',text:'Me interesa la guitarra',kind:'Objetivo',status:'Por revisar',versions:[{text:'Tocar piano'}]},
  {title:'Huerto',text:'Patatas de secano',kind:'Contexto',status:'Confirmado'}
 ]});
 const out=selectPersonalMemories(content,'Compón música de guitarra');
 assert.equal(out.length,2);assert.match(out[0].text,/Sin coste/);
 assert.equal(out[1].status,'Por revisar');assert.ok(!JSON.stringify(out).includes('piano'));assert.ok(!JSON.stringify(out).includes('Patatas'));
});
test('malformed storage cannot break chat; keys redacted and corrections attributed',()=>{
 assert.deepEqual(selectPersonalMemories('{','hola'),[]);
 const out=selectPersonalMemories(JSON.stringify({corrections:[{after:'Sigma es Siggy',reason:'Nombre Sigma',date:'2026'}],memories:[{title:'Clave',text:'gsk_0123456789abcdefghijklmn',kind:'Regla',status:'Aportado'}]}),'Sigma');
 assert.equal(out[0].kind,'Corrección');assert.ok(!JSON.stringify(out).includes('gsk_'));
});
