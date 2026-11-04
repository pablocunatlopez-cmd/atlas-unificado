import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {ASSESSMENT_WEIGHTS,ASSESSMENT_TARGETS,evaluateRepositoryAssessment,openAssessmentLedger} from './library-assessment.mjs';

const instant=Date.parse('2026-11-03T12:00:00.000Z'),revision='a'.repeat(40),sha256='b'.repeat(64);
const evaluate=value=>evaluateRepositoryAssessment(value,{now:()=>instant});
const proof=(kind,extra={})=>({id:kind,kind,sourceUrl:'https://github.com/example/project/blob/'+revision+'/'+kind+'.txt',observedAt:'2026-11-03T11:00:00Z',method:'Recorded review with dated source and artifact',outcome:'pass',revision,sha256,...extra});
function pending(){return {repository:{githubId:123,url:'https://github.com/Example/Project',revision},categoryId:'CAT-001',evidenceLevel:'D'};}
function complete({level='A'}={}){
 const evidence=['code','license','documentation','security','cost'].map(kind=>proof(kind));evidence.push(proof('test',{reproduction:{command:'node --test ./test.mjs',environment:'Isolated Windows fixture, Node runtime pinned'}}),proof('comparison',{alternatives:['https://github.com/other/alternative'],summary:'Compared identical contract coverage, rights, costs and unresolved risks.'}));
 const scores={...ASSESSMENT_WEIGHTS},scoreRationales=Object.fromEntries(Object.keys(scores).map(key=>[key,{reason:'Supplied assessment points supported by a recorded review.',evidenceIds:['code','license']}]));
 return {...pending(),evidenceLevel:level,evidence,scores,scoreRationales,legal:{status:'compatible',licenseSpdx:'MIT',obligations:['Retain copyright and license notices.'],rightsReviewed:true,obligationsReviewed:true,patentReview:'reviewed'},security:{status:'reviewed',criticalFindings:0,notes:['Scope limited to the pinned fixture revision.']},dimensions:{technicalExcellence:{score:90,reason:'Measured contract scope.',evidenceIds:['test']},strategicValue:{score:75,reason:'Documented use within this project.',evidenceIds:['comparison']},totalCost:{amount:0,currency:'EUR',period:'month',basis:'Only fixture operating assumptions, not a market price.',evidenceIds:['cost']}}};
}
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'atlas-assessment-test-')),dbPath=join(directory,'assessment.sqlite');const ledger=openAssessmentLedger({dbPath,now:()=>instant});t.after(async()=>{ledger.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('atlas-assessment-test-'));await rm(directory,{recursive:true,force:true});});return {directory,dbPath,ledger};}

test('fixed weights and targets cannot be overridden, missing scores are pending rather than invented zero',()=>{
 assert.deepEqual(ASSESSMENT_WEIGHTS,{reuse:30,aiIntegration:20,technicalSecurity:15,productPotential:15,utility:10,maintenance:10});assert.deepEqual(ASSESSMENT_TARGETS,{repositories:100000,elite:1000,winners:250,categories:250});
 assert.throws(()=>{ASSESSMENT_WEIGHTS.reuse=10;},TypeError);assert.throws(()=>evaluate({...pending(),weights:{reuse:100}}),/desconocido/);
 const result=evaluate(pending());assert.equal(result.score.total,null);assert.equal(result.score.complete,false);assert.equal(result.score.components.reuse.points,null);assert.equal(result.evidence.level,'D');assert.equal(result.status,'pending');assert.equal(result.eligibility.elite,false);assert.equal(result.eligibility.winner,false);assert.deepEqual(result.selection,{elite:false,winner:false,status:'not-selected'});assert.throws(()=>{result.legal.status='compatible';},TypeError);
});

test('complete scores remain separate from D/C evidence and never create a winner',()=>{
 for(const level of ['D','C']){const result=evaluate(complete({level}));assert.equal(result.score.total,100);assert.equal(result.score.complete,true);assert.equal(result.evidence.level,level);assert.equal(result.eligibility.elite,false);assert.equal(result.eligibility.winner,false);assert.equal(result.selection.winner,false);}
});

test('B permits elite review, while A with all gates only permits winner review, never selection',()=>{
 const b=evaluate(complete({level:'B'}));assert.equal(b.eligibility.elite,true);assert.equal(b.eligibility.winner,false);assert.ok(b.eligibility.winnerBlockers.includes('evidence-a-required'));
 const a=evaluate(complete());assert.equal(a.evidence.level,'A');assert.equal(a.eligibility.winner,true);assert.equal(a.status,'eligible-for-review');assert.equal(a.selection.winner,false);assert.equal(a.dimensions.technicalExcellence.score,90);assert.equal(a.dimensions.strategicValue.score,75);assert.equal(a.dimensions.totalCost.amount,0);assert.equal(a.evidence.validation,'structure-and-consistency-only');
});

test('missing comparison, license, security or reproducible test proof fails closed despite a perfect score',()=>{
 for(const kind of ['comparison','license','security','test']){
  const input=complete();input.evidence=input.evidence.filter(item=>item.kind!==kind);
  for(const key of Object.keys(input.scoreRationales))input.scoreRationales[key].evidenceIds=['code'];
  input.dimensions.technicalExcellence.evidenceIds=['code'];input.dimensions.strategicValue.evidenceIds=['code'];
  const result=evaluate(input);assert.equal(result.score.total,100);assert.equal(result.eligibility.winner,false,kind+' must block winner eligibility');
 }
 const input=complete();delete input.evidence.find(item=>item.kind==='test').reproduction;assert.equal(evaluate(input).evidence.level,'B');assert.equal(evaluate(input).eligibility.winner,false);
});

test('legal incompatibility, critical findings and failed tests exclude without erasing the evaluation',()=>{
 const cases=[input=>{input.legal.status='incompatible';},input=>{input.security.criticalFindings=1;},input=>{input.evidence.find(item=>item.kind==='test').outcome='fail';}];
 for(const mutate of cases){const input=complete();mutate(input);const result=evaluate(input);assert.equal(result.status,'excluded');assert.equal(result.score.total,100);assert.equal(result.eligibility.elite,false);assert.equal(result.eligibility.winner,false);}
 const restricted=complete();restricted.legal.status='restricted';assert.equal(evaluate(restricted).status,'pending');assert.equal(evaluate(restricted).eligibility.winner,false);
});

test('contradictory negative reviews block eligibility even alongside passing proof',()=>{
 for(const kind of ['license','security','code','documentation']){const input=complete();input.evidence.push(proof(kind,{id:kind+'-negative',outcome:'fail'}));const result=evaluate(input);assert.equal(result.status,'excluded');assert.equal(result.eligibility.winner,false);assert.ok(result.eligibility.eliteBlockers.includes('failed-'+kind));}
});

test('revision pinning, hashes, evidence dates and alternatives are required for claimed quality',()=>{
 const input=complete();input.evidence.forEach(item=>{item.revision='c'.repeat(40);});const result=evaluate(input);assert.equal(result.evidence.level,'C');assert.equal(result.eligibility.winner,false);
 const unpinned=complete();delete unpinned.repository.revision;assert.equal(evaluate(unpinned).evidence.level,'C');
 const missingHash=complete();missingHash.evidence.find(item=>item.kind==='license').sha256=null;assert.equal(evaluate(missingHash).evidence.level,'C');
 const same=complete();same.evidence.find(item=>item.kind==='comparison').alternatives=['https://github.com/EXAMPLE/PROJECT.git'];assert.throws(()=>evaluate(same),/iguales/);
 for(const date of ['2026-11-03T12:00:00.001Z','2026-02-30T00:00:00Z','yesterday']){const bad=complete();bad.evidence[0].observedAt=date;assert.throws(()=>evaluate(bad),/futuro|fecha/);}
});

test('input validation rejects overscores, unsourced scores, duplicate evidence, unsafe URLs and invalid categories',()=>{
 const score=complete();score.scores.reuse=31;assert.throws(()=>evaluate(score),/entre 0 y 30/);
 const noReason=complete();delete noReason.scoreRationales.reuse;assert.throws(()=>evaluate(noReason),/objeto JSON/);
 const unknownProof=complete();unknownProof.scoreRationales.reuse.evidenceIds=['missing'];assert.throws(()=>evaluate(unknownProof),/existentes/);
 const duplicate=complete();duplicate.evidence.push(duplicate.evidence[0]);assert.throws(()=>evaluate(duplicate),/único/);
 for(const url of ['javascript:alert(1)','https://name:secret@github.com/example/project','http://github.com/example/project','https://github.com/example/project/tree/main','https://github.com/example/.git'])assert.throws(()=>evaluate({...pending(),repository:{...pending().repository,url}}),/URL|HTTPS|GitHub/);
 for(const categoryId of ['CAT-000','CAT-251','CAT-1'])assert.throws(()=>evaluate({...pending(),categoryId}),/categoryId/);
 const bad=complete();bad.scores.utility=NaN;assert.throws(()=>evaluate(bad),/número/);
});

test('sparse and oversized evidence arrays are rejected before serialization',()=>{
 assert.throws(()=>evaluate({...pending(),evidence:new Array(1)}),/objeto JSON/);assert.throws(()=>evaluate({...pending(),evidence:new Array(1000000000)}),/128 elementos/);
 const input=complete();input.scoreRationales.reuse.evidenceIds=new Array(1);assert.throws(()=>evaluate(input),/texto válido/);
});

test('ledger persists validated pending assessments, chains hashes, paginates and resumes without promotion',async t=>{
 const {ledger,dbPath}=await fixture(t);const first=ledger.append(pending(),{assessmentId:'pending-1'}),second=ledger.append(complete(),{assessmentId:'complete-2'});
 assert.equal(first.sequence,1);assert.equal(first.previousHash,'0'.repeat(64));assert.equal(second.previousHash,first.hash);assert.notEqual(second.hash,first.hash);assert.equal(second.assessment.selection.winner,false);
 assert.equal(ledger.get('pending-1').assessment.score.total,null);assert.equal(ledger.get(2).hash,second.hash);assert.equal(ledger.get('missing'),null);assert.equal(ledger.list({limit:1}).total,2);assert.equal(ledger.list({limit:1}).items[0].id,'complete-2');assert.equal(ledger.list({repositoryId:999}).total,0);assert.equal(ledger.list({categoryId:'CAT-002'}).total,0);assert.equal(ledger.verifyIntegrity().ok,true);assert.equal(ledger.verifyIntegrity().authenticated,false);
 ledger.close();const reopened=openAssessmentLedger({dbPath,now:()=>instant});try{assert.equal(reopened.verifyIntegrity().records,2);assert.equal(reopened.get(1).hash,first.hash);const third=reopened.append(pending());assert.equal(third.sequence,3);assert.equal(third.previousHash,second.hash);}finally{reopened.close();}
});

test('invalid records and duplicate IDs roll back with no sequence gaps; SQL updates/deletes are blocked',async t=>{
 const {ledger,dbPath}=await fixture(t);ledger.append(pending(),{assessmentId:'one'});const invalid=complete();invalid.scores.utility=11;
 assert.throws(()=>ledger.append(invalid),/entre 0 y 10/);assert.throws(()=>ledger.append(pending(),{assessmentId:'one'}),/UNIQUE/);assert.equal(ledger.list().total,1);assert.equal(ledger.append(pending(),{assessmentId:'two'}).sequence,2);
 const direct=new DatabaseSync(dbPath);try{assert.throws(()=>direct.exec('UPDATE assessment_records SET repository_id=999'),/append-only/);assert.throws(()=>direct.exec('DELETE FROM assessment_records'),/append-only/);assert.throws(()=>direct.exec("UPDATE assessment_meta SET value='bad'"),/immutable/);}finally{direct.close();}assert.equal(ledger.verifyIntegrity().ok,true);
});

test('tampering with a stored score is detected by hashes and refuses resume',async t=>{
 const {ledger,dbPath}=await fixture(t);ledger.append(pending());ledger.append(pending());const direct=new DatabaseSync(dbPath);
 try{direct.exec('DROP TRIGGER assessment_no_update');direct.exec("UPDATE assessment_records SET payload_json=json_set(payload_json,'$.assessment.score.total',100) WHERE sequence=1");direct.exec("CREATE TRIGGER assessment_no_update BEFORE UPDATE ON assessment_records BEGIN SELECT RAISE(ABORT,'assessment ledger is append-only'); END;");}finally{direct.close();}
 assert.equal(ledger.verifyIntegrity().ok,false);assert.throws(()=>ledger.get(1),/Integridad/);assert.throws(()=>ledger.append(pending()),/Integridad/);ledger.close();assert.throws(()=>openAssessmentLedger({dbPath}),/integridad/);
});

test('same-named no-op triggers fail integrity and cannot extend the ledger',async t=>{
 const {ledger,dbPath}=await fixture(t);ledger.append(pending());const direct=new DatabaseSync(dbPath);try{direct.exec('DROP TRIGGER assessment_no_update; CREATE TRIGGER assessment_no_update BEFORE UPDATE ON assessment_records BEGIN SELECT 1; END;');}finally{direct.close();}
 assert.equal(ledger.verifyIntegrity().ok,false);assert.throws(()=>ledger.append(pending()),/append-only/);assert.equal(ledger.list().total,1);ledger.close();assert.throws(()=>openAssessmentLedger({dbPath}),/append-only/);
});

test('explicit separate database is mandatory and an existing foreign database is untouched',async t=>{
 const {directory}=await fixture(t);assert.throws(()=>openAssessmentLedger(),/dbPath explícito/);assert.throws(()=>openAssessmentLedger({dbPath:join(directory,'repo-library.sqlite')}),/separado/);
 const foreign=join(directory,'foreign.sqlite'),db=new DatabaseSync(foreign);db.exec('CREATE TABLE resources(id INTEGER PRIMARY KEY); INSERT INTO resources VALUES(7);');db.close();const before=await readFile(foreign);assert.throws(()=>openAssessmentLedger({dbPath:foreign}),/otra base/);assert.deepEqual(await readFile(foreign),before);
});
