import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasSceneEditor} from './eras-scene-editor.mjs';
const node=(id,parent=null)=>({id,parent,type:'mesh',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],asset:'assets/tree.glb'});
test('edits hierarchy with undo and redo',()=>{
 const editor=createErasSceneEditor();
 editor.add(node('root'));editor.add(node('child','root'));
 editor.update('child',{position:[2,3,4]});
 assert.deepEqual(editor.snapshot().nodes[1].position,[2,3,4]);
 assert.equal(editor.undo(),true);
 assert.deepEqual(editor.snapshot().nodes[1].position,[0,0,0]);
 assert.equal(editor.redo(),true);
 assert.deepEqual(editor.snapshot().nodes[1].position,[2,3,4]);
 assert.equal(editor.remove('root'),2);
 assert.equal(editor.snapshot().nodes.length,0);
});
test('prevents cyclic scene hierarchy',()=>{
 const editor=createErasSceneEditor();
 editor.add(node('root'));editor.add(node('child','root'));
 assert.throws(()=>editor.update('root',{parent:'child'}));
});
test('prevents invalid transforms and mutation through snapshots',()=>{
 const editor=createErasSceneEditor();
 assert.throws(()=>editor.add({...node('bad'),scale:[0,1,1]}));
 editor.add(node('valid'));
 const snap=editor.snapshot();snap.nodes[0].position[0]=999;
 assert.equal(editor.snapshot().nodes[0].position[0],0);
});
test('enforces node budget and valid parents',()=>{
 const editor=createErasSceneEditor({maxNodes:1});
 assert.throws(()=>editor.add(node('orphan','missing')));
 editor.add(node('first'));
 assert.throws(()=>editor.add(node('second')));
});
