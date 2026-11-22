import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasContainerChecks} from './atlas-container-check-plan.mjs';
const base={workspacePath:'/tmp/atlas-workspace',imageDigest:'node@sha256:'+'a'.repeat(64)};
test('plans no-network read-only restricted container without execution',()=>{
 const plan=planAtlasContainerChecks(base);
 assert.equal(plan.executed,false);
 assert.ok(plan.argv.includes('--network=none'));
 assert.ok(plan.argv.includes('--read-only'));
 assert.ok(plan.argv.includes('--cap-drop=ALL'));
 assert.ok(plan.argv.includes('--user=65534:65534'));
 assert.equal(plan.argv.at(-1),'--test');
});
test('rejects unpinned image, traversal, shell injection and networking',()=>{
 assert.throws(()=>planAtlasContainerChecks({...base,imageDigest:'node:latest'}));
 assert.throws(()=>planAtlasContainerChecks({...base,workspacePath:'/tmp/../secrets'}));
 assert.throws(()=>planAtlasContainerChecks({...base,workspacePath:'/tmp/abc;rm -rf /'}));
 assert.throws(()=>planAtlasContainerChecks({...base,checks:['curl evil.com']}));
});
