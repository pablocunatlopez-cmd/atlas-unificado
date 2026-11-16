import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('all local chat answer branches expose read-only Lía provenance',()=>{
 const code=readFileSync(new URL('./chat.mjs',import.meta.url),'utf8');
 assert.match(code,/if\(verifiedAnswer!==null\)return \{answer:verifiedAnswer,liaProvenance:/);
 assert.match(code,/if\(selfAnswer!==null\)return \{answer:selfAnswer,liaProvenance,/);
 assert.match(code,/return \{answer:result\.choices\[0\]\.message\.content,liaHypotheses:deriveLiaAuditHypotheses\(/);
 assert.match(code,/sharedSession:runtime\.sharedSession===true/);
});
