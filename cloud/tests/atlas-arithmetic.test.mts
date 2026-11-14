import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateExpression,arithmeticRequest,arithmeticAnswer} from '../lib/cloud/arithmetic.ts';
test('arithmetic fixes the observed model failure with actual operator precedence',()=>{
 assert.equal(calculateExpression('(31*16)-(31+16)'),449);
 assert.equal(calculateExpression('2+3*4'),14);
 assert.equal(calculateExpression('(2+3)*4'),20);
 assert.equal(calculateExpression('-2**2'),-4);
 assert.equal(calculateExpression('2**3**2'),512);
 assert.equal(calculateExpression('2**-2'),.25);
 assert.equal(calculateExpression('1,5 × 2 + 8 ÷ 4'),5);
 assert.equal(calculateExpression('1e-3*1000'),1);
});
test('invalid operations, precision loss and executable syntax are rejected',()=>{
 for(const input of ['1/0','2(3)','2+','(2+3','2**1000','9007199254740993','process.exit()','fetch("https://other.invalid")','Math.random()','1;2','3!','1'.repeat(241)])assert.throws(()=>calculateExpression(input),input);
 assert.throws(()=>calculateExpression('1+'.repeat(60)+'1'));
});
test('only self-contained arithmetic questions bypass the model',()=>{
 assert.equal(arithmeticRequest('¿Cuánto es (31*16)-(31+16)?')?.value,449);
 assert.equal(arithmeticRequest('Calcula: 2+2')?.value,4);
 assert.match(arithmeticRequest('calcula 1/0')?.error||'',/cero/);
 for(const q of ['¿Cuánto es el presupuesto de Ana?','Compara 2025 y 2026','Explica x*2','Calcular Math.random()','3!','https://api.test/2+2'])assert.equal(arithmeticRequest(q),null,q);
 assert.match(arithmeticAnswer(arithmeticRequest('calcula 2+2')!),/sin consumir inferencia/);
});
