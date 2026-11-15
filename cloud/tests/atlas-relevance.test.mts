import test from 'node:test';
import assert from 'node:assert/strict';
import {selectResearchSources} from '../lib/research/relevance.ts';
const source=(title:string,text:string,kind='Documento web')=>({title,text,kind,url:'https://example.invalid/'+encodeURIComponent(title),provider:'test'});
test('unrelated power-system abstracts cannot displace a source about audio measurements',()=>{
 const relevant=source('Web Audio signal analysis','Audio analysis supplies signal samples and frequency data.'),noise=source('Modelado de sistemas de potencia','Modelos lineales para redes eléctricas de transporte.');
 const result=selectResearchSources('métricas RMS de sonido y frecuencia',[noise,relevant]);
 assert.deepEqual(result.accepted,[relevant]);assert.equal(result.rejected[0].url,noise.url);
});
test('metadata is excluded even when its title repeats the query',()=>{
 const metadata=source('Audio RMS THD','Audio RMS THD','Metadatos bibliográficos');assert.equal(selectResearchSources('Audio RMS THD',[metadata]).accepted.length,0);
});
test('ranking is bounded and describes lexical matching rather than semantic proof',()=>{
 const a=source('Audio','Signal analysis'),b=source('Audio RMS THD','Audio RMS THD signal');
 const result=selectResearchSources('audio RMS THD',[a,b],1);assert.deepEqual(result.accepted,[b]);assert.equal(result.rejected.length,1);assert.equal(result.method,'lexical-overlap-v1');
 assert.equal(selectResearchSources('qué y para',[a]).accepted.length,0);
});
