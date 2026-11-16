import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAtlasCodingClaim} from './atlas-coding-claim-schema.mjs';
const valid={proposalId:'task-1',actorId:'owner',operation:'write',baseCommit:'a'.repeat(40),
 diffDigest:'b'.repeat(64),nonce:'c'.repeat(64),issuedAt:123,signature:'AAAA'};
test('accepts correctly shaped claims without granting authority',()=>{
 const parsed=parseAtlasCodingClaim(valid);
 assert.equal(parsed.success,true);
 assert.equal('authorizationGranted' in parsed.data,false);
});
test('rejects extra keys, wrong types, invalid hashes and oversized signatures',()=>{
 for(const value of [{...valid,admin:true},{...valid,issuedAt:'123'},
  {...valid,diffDigest:'xyz'},{...valid,signature:'a'.repeat(513)},
  {...valid,operation:'shell'}]) assert.equal(parseAtlasCodingClaim(value).success,false);
});
