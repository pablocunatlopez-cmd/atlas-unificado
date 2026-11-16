import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('ERAS runtime imports Atlas mode without replacing existing renderer',()=>{
 const source=readFileSync(new URL('../cloud/public/house/runtime.js',import.meta.url),'utf8');
 assert.match(source,/import \{createAtlasHouseMode\} from '\.\/atlas-mode\.js'/);
 assert.match(source,/const atlasMode=createAtlasHouseMode/);
 assert.match(source,/atlasMode\.frame\(delta\*1000\)/);
 assert.match(source,/atlasMode\.dispose\(\)/);
 assert.match(source,/message\.type==='atlas:house:atlas-mode'/);
 assert.match(source,/renderer\.render\(house\.scene,camera\)/);
 assert.match(source,/visualSceneMounted:false/);
});
