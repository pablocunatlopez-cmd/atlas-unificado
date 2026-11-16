import test from 'node:test';import assert from 'node:assert/strict';import {publicIPv4,webUrl,parseDuckDuckGoResults,sanitizeNetError,publicGet} from './internet.mjs';import {freeAgent} from './providers.mjs';
test('lector rechaza loopback, redes privadas y URLs con credenciales',()=>{for(const ip of ['127.0.0.1','10.2.3.4','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','::1'])assert.equal(publicIPv4(ip),false);assert.equal(publicIPv4('8.8.8.8'),true);for(const u of ['http://example.com','https://localhost','https://a:b@example.com','https://example.com:8788','https://127.1'])assert.throws(()=>webUrl(u));});
test('lector bloquea también rangos IPv4 especiales y de documentación',()=>{for(const ip of ['192.0.2.10','198.18.0.1','198.51.100.25','203.0.113.40','192.88.99.1'])assert.equal(publicIPv4(ip),false);assert.equal(publicIPv4('1.1.1.1'),true);});
test('búsqueda DuckDuckGo extrae extractos y solo conserva destinos HTTPS públicos',()=>{const html=`<a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.example%2Fguide&amp;rut=1" class='result-link'>Example &amp; Guide</a><td class='result-snippet'>A <b>useful</b> snippet &amp; detail</td><a href="//duckduckgo.com/l/?uddg=https%3A%2F%2F127.0.0.1%2Fadmin" class='result-link'>Private target</a><td class='result-snippet'>No</td>`;const results=parseDuckDuckGoResults(html);assert.equal(results.length,1);assert.equal(results[0].url,'https://docs.example/guide');assert.equal(results[0].title,'Example & Guide');assert.equal(results[0].excerpt,'A useful snippet & detail');});
test('colaborador solo llama a ruta gratuita y sin fallback de pago',async()=>{let calls=0;await assert.rejects(freeAgent([{role:'user',content:'hi'}],'test',async(u,o)=>{calls++;assert.equal(JSON.parse(o.body).model,'openrouter/free');assert.equal(u,'https://openrouter.ai/api/v1/chat/completions');return {ok:false,status:429};}));assert.equal(calls,1);});
test('sanitizeNetError elimina hostname, IP y causa interna',()=>{
 const interno=Object.assign(Error('getaddrinfo ENOTFOUND servidor-interno.corp.local'),{code:'ENOTFOUND',hostname:'servidor-interno.corp.local'});
 const limpio=sanitizeNetError(interno);
 assert.equal(limpio.message,'No se pudo resolver el nombre DNS del destino.');
 assert.ok(!limpio.message.includes('servidor-interno'));
 assert.equal(sanitizeNetError(Object.assign(Error('connect ECONNREFUSED 10.0.0.4:443'),{code:'ECONNREFUSED'})).message,'No se pudo establecer una conexión segura con el destino.');
 assert.equal(sanitizeNetError(Object.assign(Error('timeout'),{code:'ETIMEDOUT'})).message,'Tiempo de espera agotado al contactar el destino.');
 assert.equal(sanitizeNetError(Error('Tiempo de resolución DNS agotado para ejemplo-interno.es')).message,'Tiempo de espera agotado al contactar el destino.');
 assert.equal(sanitizeNetError(Error('causa desconocida con 192.168.1.10')).message,'No se pudo acceder al destino solicitado.');
});
test('sanitizeNetError conserva mensajes ya seguros y mensajes saneados (redirecciones)',()=>{
 const seguro=Error('La web respondió HTTP 503');assert.equal(sanitizeNetError(seguro),seguro);
 assert.equal(sanitizeNetError(Error('Destino de red privado o no permitido')).message,'Destino de red privado o no permitido');
 const yaSaneado=Error('No se pudo resolver el nombre DNS del destino.');
 assert.equal(sanitizeNetError(yaSaneado).message,'No se pudo resolver el nombre DNS del destino.');
 assert.equal(sanitizeNetError(Error('Contenido insuficiente')).message,'Contenido insuficiente');
});
test('publicGet rechaza destinos privados con mensaje seguro y sin red',async()=>{
 await assert.rejects(publicGet('https://127.0.0.1/admin'),/Solo páginas HTTPS públicas|Destino de red privado/);
});
