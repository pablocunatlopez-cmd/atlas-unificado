import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recordAtlasCodingIntent} from './atlas-coding-intent-log.mjs';
import {reconcileAtlasCodingIntent} from './atlas-coding-intent-reconcile.mjs';
const data={transactionId:'tx',proposalId:'task',baseCommit:'a'.repeat(40),diffDigest:'b'.repeat(64)};
async function withDir(fn){const directory=await mkdtemp(join(tmpdir(),'atlas-reconcile-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}
test('missing intent never authorizes retry',()=>withDir(async directory=>{
 const r=await reconcileAtlasCodingIntent({directory,transactionId:'tx',readHeadCommit:async()=>data.baseCommit});
 assert.equal(r.status,'intent_not_found');assert.equal(r.retrySafe,false);
}));
test('matching HEAD is not proof of failed transaction',()=>withDir(async directory=>{
 await recordAtlasCodingIntent({...data,directory});
 const r=await reconcileAtlasCodingIntent({directory,transactionId:'tx',readHeadCommit:async()=>data.baseCommit});
 assert.equal(r.status,'base_still_visible');assert.equal(r.retrySafe,false);
}));
test('changed HEAD is not proof the intended patch was committed',()=>withDir(async directory=>{
 await recordAtlasCodingIntent({...data,directory});
 const r=await reconcileAtlasCodingIntent({directory,transactionId:'tx',readHeadCommit:async()=> 'c'.repeat(40)});
 assert.equal(r.status,'head_changed_since_intent');assert.equal(r.retrySafe,false);
}));
test('corrupt intent fails closed',()=>withDir(async directory=>{
 await writeFile(join(directory,'tx.intent.json'),'{');
 await chmod(join(directory,'tx.intent.json'),0o600);
 const r=await reconcileAtlasCodingIntent({directory,transactionId:'tx',readHeadCommit:async()=>data.baseCommit});
 assert.equal(r.status,'corrupt_or_partial_intent');assert.equal(r.retrySafe,false);
}));

test('symlink intent is never followed',()=>withDir(async directory=>{
 const outside=join(directory,'outside.json');
 await writeFile(outside,JSON.stringify({...data,schemaVersion:1,status:'intent_recorded_no_commit_claim'}));
 await symlink(outside,join(directory,'tx.intent.json'));
 const r=await reconcileAtlasCodingIntent({directory,transactionId:'tx',readHeadCommit:async()=>data.baseCommit});
 assert.equal(r.status,'unsafe_intent_file');assert.equal(r.retrySafe,false);
}));
