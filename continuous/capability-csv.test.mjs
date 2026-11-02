import test from 'node:test';
import assert from 'node:assert/strict';
import {csvTask,csvOracle,generateCsvCases} from './capability-csv.mjs';

const ok=rows=>({ok:true,rows}),bad=error=>({ok:false,error});

test('the CSV descriptor has eight compact external examples matching its independent oracle',()=>{
 assert.equal(csvTask.id,'csv-parse');assert.equal(csvTask.acceptanceTests.length,8);
 assert.ok(JSON.stringify(csvTask.acceptanceTests).length<12000);assert.ok(csvTask.task.length<4000);
 for(const item of csvTask.acceptanceTests)assert.deepEqual(csvOracle(item.input),item.expected);
 assert.equal(Object.isFrozen(csvTask.acceptanceTests[0].input),true);
});

test('empty fields, blank records, final separators and BOM have explicit distinct meanings',()=>{
 for(const [text,rows] of [['',[]],['\uFEFF',[]],['\uFEFF\uFEFF',[['\uFEFF']]],['""',[['']]],['\n',[['']]],['\r\n\n',[[''],['']]],['a,b,',[['a','b','']]],['a,b,\r\n',[['a','b','']]],['a,,\n\n',[['a','',''],['']]],['  a  , b ',[['  a  ',' b ']]]])assert.deepEqual(csvOracle({text}),ok(rows),JSON.stringify(text));
});

test('quoted text preserves exact separators, whitespace, Unicode and embedded line endings',()=>{
 assert.deepEqual(csvOracle({text:'"first\r\nline",second\n"🌍, Ω","quote "" doubled"'}),ok([['first\r\nline','second'],['🌍, Ω','quote " doubled']]));
 assert.deepEqual(csvOracle({text:'"\r";"\n";"\t"',delimiter:';'}),ok([['\r','\n','\t']]));
 assert.deepEqual(csvOracle({text:'"a\tb"\tc\r\n\td\t',delimiter:'\t'}),ok([['a\tb','c'],['','d','']]));
});

test('malformed quotes and bare record CR are rejected instead of silently repaired',()=>{
 for(const text of ['a"b,c','"unterminated','"done" suffix','"done" ',' "starts after a space"','a\rb','"a"\r','"a""','"a""b','"a",b"'])assert.deepEqual(csvOracle({text}),bad('invalid_csv'),JSON.stringify(text));
 assert.deepEqual(csvOracle({text:'""""'}),ok([['"']]));
});

test('types and delimiters are validated without coercion or inherited text',()=>{
 for(const input of [null,[],{},7,{text:null},{text:[]},{text:true},Object.create({text:'a,b'})])assert.deepEqual(csvOracle(input),bad('invalid_input'));
 for(const delimiter of [null,0,true,'','|','::','\\t','\n','"'])assert.deepEqual(csvOracle({text:'a,b',delimiter}),bad('invalid_delimiter'));
 assert.deepEqual(csvOracle({text:'001,true,null,3.50'}),ok([['001','true','null','3.50']]));
});

test('text, row and column budgets accept their exact boundaries and reject overflow',()=>{
 assert.deepEqual(csvOracle({text:'x'.repeat(12000)}),ok([['x'.repeat(12000)]]));
 assert.deepEqual(csvOracle({text:'x'.repeat(12001)}),bad('limit_exceeded'));
 assert.deepEqual(csvOracle({text:','.repeat(63)}),ok([Array(64).fill('')]));
 assert.deepEqual(csvOracle({text:','.repeat(64)}),bad('limit_exceeded'));
 assert.equal(csvOracle({text:'\n'.repeat(256)}).rows.length,256);
 assert.deepEqual(csvOracle({text:'\n'.repeat(257)}),bad('limit_exceeded'));
 // Type/delimiter validation precede the size budget, as specified.
 assert.deepEqual(csvOracle({text:'x'.repeat(12001),delimiter:'|'}),bad('invalid_delimiter'));
});

test('inputs remain unchanged and generations are deterministic, bounded and cover successful plus refuted parses',()=>{
 for(const seed of [0,1,173,4294967295]){
  const cases=generateCsvCases(seed),original=structuredClone(cases);assert.equal(cases.length,8);assert.deepEqual(generateCsvCases(seed),cases);
  for(const input of cases)Object.freeze(input);
  const results=cases.map(csvOracle);assert.deepEqual(cases,original);
  assert.equal(results.filter(item=>item.ok).length,3);assert.equal(results.filter(item=>item.error==='invalid_csv').length,3);assert.equal(results.at(-1).error,'limit_exceeded');
  assert.ok(cases.every(input=>JSON.stringify(input).length<30000));
 }
 assert.notDeepEqual(generateCsvCases(0),generateCsvCases(1));
 for(const seed of [-1,0.5,4294967296,NaN,'1'])assert.throws(()=>generateCsvCases(seed),/uint32/);
});
