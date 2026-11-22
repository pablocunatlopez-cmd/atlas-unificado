import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPersonalMemories,withWorkshopMemories} from '../lib/cloud/personal-context.ts';
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

test('the design cabinet stays scoped and appends complete records within the workshop budget',()=>{
 const content=JSON.stringify({memories:[
  {title:'Taller',text:'Acceso abierto al pabellón',kind:'Regla',status:'Confirmado',scope:'module:workshop'},
  {title:'Mente',text:'Mi recuerdo privado de Mente',kind:'Regla',status:'Confirmado',scope:'room:mind'}
 ]});
 assert.deepEqual(selectPersonalMemories(content,'pabellón'),[]);
 const notes=selectPersonalMemories(content,'pabellón',['global','module:workshop']);assert.equal(notes.length,1);assert.equal(notes[0].scope,'module:workshop');
 const base='b'.repeat(13600),prompt=withWorkshopMemories(base,Array.from({length:8},()=>({...notes[0],text:'x'.repeat(1200)})));
 assert.ok(prompt.length<=15000);assert.ok(prompt.startsWith(base));const records=prompt.slice(base.length).split('\n').filter(line=>line.startsWith('{'));assert.ok(records.length>0);for(const record of records)assert.equal(JSON.parse(record).text.length,500);
 assert.equal(withWorkshopMemories(base,[]),base);
});

test('global corrections do not enter a single resident profile',()=>{
 const state=JSON.stringify({corrections:[{after:'Sigma conserva esta corrección global',reason:'Sigma'}]});
 assert.equal(selectPersonalMemories(state,'Sigma',['resident:games-desk']).length,0);
 assert.equal(selectPersonalMemories(state,'Sigma').length,1);
});
