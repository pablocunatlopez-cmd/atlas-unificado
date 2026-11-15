import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderAtlasCommandCenter} from './atlas-command-center.mjs';
test('renders premium command center and escapes untrusted content',()=>{
 const html=renderAtlasCommandCenter({project:'Atlas <script>alert(1)</script>',
  tasks:[{title:'ERAS <img src=x>',detail:'Review & verify'}],metrics:{proposals:3}});
 assert.match(html,/Atlas &lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/ERAS &lt;img src=x&gt;/);
 assert.match(html,/Review &amp; verify/);
 assert.match(html,/>3<\/strong>/);
});
test('rejects malformed status and task data',()=>{
 assert.throws(()=>renderAtlasCommandCenter({status:'unknown'}));
 assert.throws(()=>renderAtlasCommandCenter({tasks:[{title:'x'}]}));
});

test('renders CPU diagnostics without claiming real inference',()=>{
 const html=renderAtlasCommandCenter({localDiagnostics:{
  status:'candidate_ready',llama:{ready:true},
  memory:{freeRamMb:4096}
 }});
 assert.match(html,/Diagnóstico local/);
 assert.match(html,/4096 MB/);
 assert.match(html,/Inferencia real: no verificada/);
});
test('rejects malformed local diagnostics',()=>{
 assert.throws(()=>renderAtlasCommandCenter({localDiagnostics:{
  status:'candidate_ready',llama:{ready:true},
  memory:{freeRamMb:NaN}
 }}));
});
