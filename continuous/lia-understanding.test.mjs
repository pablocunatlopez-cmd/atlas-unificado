import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLiaUnderstandingRecord,composeLiaUnderstanding} from '../cloud/public/house/lia-understanding.js';
test('Lía distinguishes memory, observations and unknown without treating them as truth',()=>{
 const known=createLiaUnderstandingRecord({id:'a',statement:'Recuerdo declarado',source:'memory'});
 const observed=createLiaUnderstandingRecord({id:'b',statement:'Dato observado',source:'observation',evidence:['sensor:1']});
 const unknown=createLiaUnderstandingRecord({id:'c',statement:'Todavía no se sabe'});
 assert.deepEqual([known.component,observed.component,unknown.component],['Atlas','Ion','Constelación']);
 assert.equal(observed.evidenceStatus,'supplied_not_verified');
 assert.equal(unknown.unknownIsNotFalse,true);
 const result=composeLiaUnderstanding({records:[known,observed,unknown]});
 assert.deepEqual([result.known,result.observed,result.unknown],[1,1,1]);
 assert.equal(result.truthVerified,false);
 assert.equal(result.autonomousActionPerformed,false);
});
test('records are bounded, immutable and require unique IDs',()=>{
 const r=createLiaUnderstandingRecord({id:'x',statement:'Prueba',evidence:['documento']});
 assert.ok(Object.isFrozen(r));
 assert.ok(Object.isFrozen(r.evidence));
 assert.throws(()=>createLiaUnderstandingRecord({id:'x',statement:'a',source:'guessed'}));
 assert.throws(()=>createLiaUnderstandingRecord({id:'x',statement:'a',evidence:Array(13).fill('x')}));
 assert.throws(()=>composeLiaUnderstanding({records:[r,r]}));
});
