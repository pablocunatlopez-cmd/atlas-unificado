import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasIsolatedChecks} from './atlas-isolated-check-policy.mjs';
test('only permits bounded local checks and no network',()=>{
 const plan=planAtlasIsolatedChecks({checks:['node --check','node --test']});
 assert.equal(plan.executable,false);
 assert.equal(plan.network,false);
 assert.equal(plan.secretsAllowed,false);
 assert.equal(plan.checksExecuted,false);
});
test('rejects arbitrary commands, networking and resource escalation',()=>{
 assert.throws(()=>planAtlasIsolatedChecks({checks:['curl example.com']}));
 assert.throws(()=>planAtlasIsolatedChecks({network:true}));
 assert.throws(()=>planAtlasIsolatedChecks({memoryMb:100000}));
 assert.throws(()=>planAtlasIsolatedChecks({workspaceReadOnly:false}));
});
