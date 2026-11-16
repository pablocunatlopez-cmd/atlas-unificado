import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Lía house UI derives identity from canonical model and exposes reversible spiral',()=>{
 const ui=readFileSync(new URL('../cloud/app/atlas-house.tsx',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('../cloud/app/house-scene.tsx',import.meta.url),'utf8');
 assert.match(ui,/LIA_IDENTITY\.vertices\.map/);
 assert.match(ui,/api\?\.atlasMode\(next\?'enter':'leave'\)/);
 assert.match(ui,/Constelación aquello que todavía no puede ver o saber/);
 assert.match(bridge,/atlasMode:\(value:'enter'\|'leave'\)=>void/);
 assert.match(bridge,/atlasMode:value=>send\('atlas-mode',\{value\}\)/);
});
