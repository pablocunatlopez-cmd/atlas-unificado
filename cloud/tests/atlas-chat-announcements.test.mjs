import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {createRequire} from 'node:module';
import * as React from 'react';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const text=readFileSync(process.env.ATLAS_CHAT_SOURCE||new URL('../app/cloud-chat.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('cloud-chat.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CloudChat');
assert.ok(component);
const stateNames=[];
const collect=n=>{if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')stateNames.push(n.name.elements[0].getText(ast));ts.forEachChild(n,collect);};collect(component);
const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(overrides={}){
 let stateIndex=0;
 const exports={};
 const hooks={...React,useState(initial){const name=stateNames[stateIndex++];return[Object.hasOwn(overrides,name)?overrides[name]:typeof initial==='function'?initial():initial,()=>{}];},useEffect(){},useCallback:fn=>fn,useRef:value=>({current:value})};
 const context={exports,require:name=>name==='react'?hooks:name.endsWith('.css')?{default:new Proxy({},{get:(_,key)=>key})}:require(name),AbortController,AbortSignal,URL,URLSearchParams,console,setTimeout,clearTimeout};
 new Script(code).runInNewContext(context);
 return exports.default({signedIn:true,displayName:'Usuario de prueba',signInPath:'/signin-with-chatgpt'});
}
function nodes(tree){const result=[];function visit(n){if(Array.isArray(n)){n.forEach(visit);return;}if(!n||typeof n!=='object'||!n.props)return;result.push(n);visit(n.props.children);}visit(tree);return result;}
const byRole=(tree,role)=>nodes(tree).filter(n=>n.props.role===role);
function content(tree){if(Array.isArray(tree))return tree.map(content).join('');if(tree&&typeof tree==='object'&&tree.props)return content(tree.props.children);return typeof tree==='string'?tree:'';}
for(const status of ['queued','running','reconnecting'])test(`${status}: one status region and no work notice inside the message log`,()=>{
 const tree=render({job:{id:'job-test',status},polling:status!=='reconnecting',messages:[{id:'user-test',role:'user',content:'Pregunta de prueba'}]});
 const statuses=byRole(tree,'status'),log=byRole(tree,'log');assert.equal(statuses.length,1);assert.equal(log.length,1);
 assert.equal(statuses[0].props['aria-live'],'polite');assert.equal(statuses[0].props['aria-atomic'],true);
 assert.equal(byRole(log[0],'status').length,0);assert.doesNotMatch(content(log[0]),/Tu mensaje|Conectando las ideas/);
 assert.equal(nodes(tree).filter(n=>n.type==='article').length,1);
 if(status==='reconnecting')assert.ok(nodes(tree).some(n=>n.type==='button'&&content(n)==='Comprobar respuesta'));
});
test('cancellation is announced as a request while the operation is still pending',()=>{
 const tree=render({job:{id:'job-test',status:'running'},cancelling:true});assert.match(content(byRole(tree,'status')[0]),/Solicitando detener/);
 assert.ok(nodes(tree).some(n=>n.type==='button'&&n.props.disabled===true&&content(n)==='■Deteniendo'));
});
test('the status region is present before work starts and remains after completion',()=>{
 const idle=byRole(render(),'status'),done=byRole(render({notice:'Respuesta recibida.',messages:[{role:'assistant',content:'Respuesta de prueba'}]}),'status');
 assert.equal(idle.length,1);assert.equal(done.length,1);assert.equal(idle[0].props['aria-live'],'polite');assert.equal(content(done[0]),'Respuesta recibida.');
});
test('errors stay outside the transcript and expose an alert',()=>{
 const tree=render({error:'Error de prueba'}),log=byRole(tree,'log')[0];assert.equal(byRole(tree,'alert').length,1);assert.equal(byRole(log,'alert').length,0);
});
