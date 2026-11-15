import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const text=readFileSync(process.env.ATLAS_OBSERVATORY_SOURCE||new URL('../app/core-observatory.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('core-observatory.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const card=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ProcessCard');
const states=ast.statements.filter(ts.isVariableStatement).flatMap(n=>n.declarationList.declarations).find(n=>n.name.getText(ast)==='states');
assert.ok(card);assert.ok(states);
const code=ts.transpileModule(`const ${states.getText(ast)};\n${card.getText(ast)}\nexport {ProcessCard};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(state,connected){const exports={};new Script(code).runInNewContext({exports,require,styles:new Proxy({},{get:(_,key)=>key}),phaseNames:{observe:'Observar'}});return exports.ProcessCard({connected,process:{id:'experience',label:'Espiral de experiencia',state,phase:'observe',counters:{observations:7,trials:3}}});}
function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object'||!tree.props)return [];return[tree,...nodes(tree.props.children)];}
function content(tree){if(Array.isArray(tree))return tree.map(content).join('');if(tree&&typeof tree==='object'&&tree.props)return content(tree.props.children);return typeof tree==='string'?tree:'';}
for(const [state,label] of Object.entries({idle:'En reposo',running:'Trabajando',passed:'Prueba superada',failed:'Refutado',waiting:'En espera'}))for(const connected of [true,false])test(`${state}, connected=${connected}: preserve results and avoid claiming live work offline`,()=>{
 const tree=render(state,connected),terminal=['passed','failed'].includes(state),expected=connected||terminal?label:'En espera';
 const span=nodes(tree).find(n=>n.type==='span'&&String(n.props.className).includes('processState'));
 assert.equal(content(span),expected);
 assert.equal(String(tree.props.className).includes('processRunning'),connected&&state==='running');
 assert.equal(content(tree).includes('Resultado conservado'),!connected&&terminal);
 assert.match(content(tree),/7 observaciones/);assert.match(content(tree),/3 pruebas/);
});
