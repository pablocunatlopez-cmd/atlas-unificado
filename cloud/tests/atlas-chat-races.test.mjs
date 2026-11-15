import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import ts from 'typescript';

// Execute the actual component handlers with deferred network/hydration boundaries.
// No inference or private conversation is needed to reproduce these races.
const text=readFileSync(process.env.ATLAS_CHAT_SOURCE||new URL('../app/cloud-chat.tsx',import.meta.url),'utf8');
const source=ts.createSourceFile('cloud-chat.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function handler(name,context){
 let declaration;const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text===name)declaration=node;ts.forEachChild(node,visit);};visit(source);assert.ok(declaration,name);
 const code=ts.transpileModule(declaration.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return new Script(code+'\n'+name).runInNewContext(context);
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const calls=[],state={draft:'',notice:'',error:'',job:{id:'old',status:'running'},polling:true,cancelling:false,messages:[{role:'user',content:'encargo conservado'}]};
 const context={job:state.job,cancelling:false,sequence:{current:1},mounted:{current:true},pollAbort:{current:{abort(){calls.push('abort');}}},pendingText:{current:'encargo conservado'},retry:{current:{requestId:'same'}},refreshArchive:()=>calls.push('archive'),encodeURIComponent,AbortSignal,AbortController,delay:async()=>{},readJson:async()=>({status:'cancelled'})};
 for(const key of ['draft','notice','error','job','polling','cancelling','messages'])context['set'+key[0].toUpperCase()+key.slice(1)]=value=>{state[key]=typeof value==='function'?value(state[key]):value;calls.push(key);};
 return{context,state,calls,cancel:handler('cancel',context)};
}
test('a late cancellation cannot clear a newly opened thread or its pending request',async()=>{
 const f=fixture(),network=deferred();f.context.readJson=()=>network.promise;const pending=f.cancel();f.context.sequence.current++;f.state.job={id:'new',status:'running'};f.state.draft='nuevo borrador';f.calls.length=0;
 network.resolve({status:'cancelled'});await pending;assert.deepEqual(f.calls,[]);assert.equal(f.state.job.id,'new');assert.equal(f.state.draft,'nuevo borrador');
});
test('a stale cancellation error and unmount have no UI side effects',async()=>{
 for(const unmount of [false,true]){const f=fixture(),network=deferred();f.context.readJson=()=>network.promise;const pending=f.cancel();if(unmount)f.context.mounted.current=false;else f.context.sequence.current++;f.calls.length=0;network.reject(Error('offline'));await pending;assert.deepEqual(f.calls,[]);}
});
test('completed cancellation recovery keeps its original scope even if the user navigates during hydration',async()=>{
 const f=fixture(),hydrated=deferred();let scope;f.context.readJson=async()=>({status:'completed',conversationId:'old-thread'});f.context.hydrate=(id,current)=>{scope={id,current};return hydrated.promise;};const pending=f.cancel();await tick();assert.equal(scope.current,1);f.context.sequence.current++;f.calls.length=0;hydrated.resolve(null);await pending;assert.deepEqual(f.calls,[]);assert.equal(f.context.pendingText.current,'encargo conservado');
});
test('current cancellation retains the user message and restores the editable request',async()=>{
 const f=fixture(),before=JSON.stringify(f.state.messages);await f.cancel();assert.equal(JSON.stringify(f.state.messages),before);assert.equal(f.state.draft,'encargo conservado');assert.equal(f.state.job,null);assert.equal(f.state.cancelling,false);assert.equal(f.context.retry.current,null);
});
test('a response that completed before cancellation is retained once',async()=>{
 const f=fixture();f.context.readJson=async()=>({status:'completed',result:{answer:'respuesta'}});await f.cancel();assert.equal(f.state.messages.filter(m=>m.role==='assistant').length,1);assert.equal(f.state.messages.at(-1).content,'respuesta');assert.equal(f.state.draft,'');assert.equal(f.context.pendingText.current,'');
});
test('old polling cannot clear a new job after waiting for conversation hydration',async()=>{
 const f=fixture(),hydrated=deferred();f.context.readJson=async()=>({status:'completed',conversationId:'old-thread',result:{answer:'old'}});f.context.hydrate=()=>hydrated.promise;const follow=handler('followJob',f.context),pending=follow('old',1);await tick();f.context.sequence.current++;f.state.job={id:'new',status:'running'};f.calls.length=0;hydrated.resolve(null);await pending;assert.deepEqual(f.calls,[]);assert.equal(f.state.job.id,'new');
});
test('starting a new conversation clears stale loading and cancellation flags',()=>{
 const f=fixture();Object.assign(f.context,{sending:{current:false},inputRef:{current:null},pendingText:{current:'old'}});const values={};for(const name of ['ConversationId','Title','LoadingThread','Cancelling','Messages','Draft','Job','Polling','SidebarOpen','Error','Notice','VisibleLimit'])f.context['set'+name]=v=>{values[name]=v;};handler('newConversation',f.context)();assert.equal(values.LoadingThread,false);assert.equal(values.Cancelling,false);assert.equal(values.ConversationId,null);assert.equal(f.context.sequence.current,2);
});
test('a new submission in the same conversation invalidates an older pending cancellation',async()=>{
 const f=fixture(),cancelled=deferred(),submitted=deferred();Object.assign(f.context,{signedIn:true,draft:'siguiente encargo',busy:false,internet:false,sending:{current:false},nearBottom:{current:false},messages:f.state.messages,conversationId:'same-thread',title:'contexto',crypto:{randomUUID:()=> 'new-request'},setSubmitting(){},setConversationId(){},setTitle(){},followJob(){}});
 f.context.readJson=(url,options)=>options.method==='DELETE'?cancelled.promise:submitted.promise;
 const old=f.cancel(),next=handler('submit',f.context)();assert.equal(f.context.sequence.current,2);f.calls.length=0;cancelled.resolve({status:'cancelled'});await old;assert.deepEqual(f.calls,[]);
 submitted.resolve({jobId:'new',conversationId:'same-thread',status:'queued'});await next;assert.equal(f.state.job.id,'new');assert.equal(f.state.messages.filter(m=>m.content==='siguiente encargo').length,1);
});
