import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
import ts from 'typescript';
import {setImmediate as flush} from 'node:timers/promises';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../app/cinema-panel.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n?.props?[n,...nodes(n.props.children)]:[];}
function text(n){return Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):typeof n==='string'?n:'';}
function harness(api){
 const state=[],refs=[];let cursor=0,refCursor=0;const exports={};
 const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(){}};
 const imports=id=>id==='react'?react:id==='react/jsx-runtime'?require(id):id.endsWith('.css')?{}:id==='./house-scene'?{HOUSE_ROOMS:[]}:{};
 new Script(code).runInNewContext({exports,require:imports,Error,AbortController,AbortSignal,crypto,URL,Blob,setTimeout});
 const render=()=>{cursor=0;refCursor=0;return nodes(exports.default({houseApi:api,ready:true}));};
 return {render,state};
}
function live(all){const regions=all.filter(n=>n.props.role==='status');assert.equal(regions.length,1,'one persistent cinema status region');assert.equal(regions[0].props['aria-live'],'polite');assert.equal(regions[0].props['aria-atomic'],true);return regions[0];}
test('capture transitions retain a polite region from initial render to pending and completion',async()=>{
 let resolve;const wait=new Promise(r=>{resolve=r;}),calls=[];
 const h=harness({record:options=>{calls.push(options);return wait;},revoke(){}});
 let all=h.render();assert.equal(text(live(all)),'');assert.equal(calls.length,0);
 all.find(n=>n.type==='button'&&text(n)==='Grabar la casa').props.onClick();
 all=h.render();assert.match(text(live(all)),/Grabando/);assert.ok(all.find(n=>n.type==='button'&&text(n)==='Grabando…').props.disabled);assert.equal(calls.length,1);
 resolve({url:'blob:test',filename:'test.webm',mime:'video/webm'});await wait;await flush();
 all=h.render();assert.match(text(live(all)),/Captura 3D terminada/);assert.ok(all.some(n=>n.type==='a'&&n.props.download==='test.webm'));
});
test('capture failure keeps an alert separate and download progress has an accessible name',async()=>{
 const h=harness({record:async()=>{throw Error('Captura no disponible');},revoke(){}});
 let all=h.render();all.find(n=>n.type==='button'&&text(n)==='Grabar la casa').props.onClick();await flush();
 all=h.render();live(all);assert.equal(text(all.find(n=>n.props.role==='alert')),'Captura no disponible');
 // VideoState is the seventh state in the production component; expose the existing optional download view.
 h.state[6]={openfieldInstalled:true,totalBytes:100,downloadedBytes:25};
 const progress=h.render().find(n=>n.type==='progress');assert.ok(progress);assert.equal(progress.props.value,25);assert.equal(progress.props.max,100);assert.equal(progress.props['aria-label'],'Descarga de modelos de vídeo');
 for(const downloadedBytes of [0,100]){h.state[6]={openfieldInstalled:true,totalBytes:100,downloadedBytes};const bar=h.render().find(n=>n.type==='progress');assert.equal(bar.props.value,downloadedBytes);assert.equal(bar.props.max,100);}
});
