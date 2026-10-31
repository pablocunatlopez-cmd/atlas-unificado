import test from 'node:test';import assert from 'node:assert/strict';import {freeAgent} from './providers.mjs';
test('crítica externa fija ruta gratuita, envía solo borrador y pregunta y no reintenta pagos',async()=>{
 let sent;const result=await freeAgent([{role:'user',content:'revisa'}],'sk-or-test',async(url,opts)=>{sent={url,body:JSON.parse(opts.body),auth:opts.headers.Authorization};return {ok:true,json:async()=>({choices:[{message:{content:'Busca un contraejemplo.'}}],model:'proveedor/model:free',usage:{cost:0}})};},'openrouter/free');
 assert.match(sent.url,/openrouter\.ai\/api\/v1\/chat\/completions$/);assert.equal(sent.body.model,'openrouter/free');assert.equal(sent.auth,'Bearer sk-or-test');assert.equal(result.text,'Busca un contraejemplo.');assert.equal(result.cost,0);
});
test('falla por cuota sin tocar otra ruta',async()=>{let count=0;await assert.rejects(freeAgent([{role:'user',content:'x'}],'sk-or-test',async()=>{count++;return {ok:false,status:429};}),/Cuota gratuita agotada/);assert.equal(count,1);});
test('la estrella elegida se vuelve a validar gratuita antes de enviar el borrador',async()=>{
 let calls=0;const f=async(url,opts)=>{calls++;if(url.endsWith('/models'))return {ok:true,json:async()=>({data:[{id:'vendor/model:free',name:'Free',pricing:{prompt:'0',completion:'0'},architecture:{output_modalities:['text']}}]})};assert.equal(JSON.parse(opts.body).model,'vendor/model:free');return {ok:true,json:async()=>({model:'vendor/model:free',choices:[{message:{content:'Revisado'}}]})};};
 const r=await freeAgent([{role:'user',content:'Revisa este borrador'}],'sk-or-test',f,'vendor/model:free');assert.equal(r.model,'vendor/model:free');assert.equal(calls,2);
});
