import {verify as cryptoVerify,createPublicKey,KeyObject} from 'node:crypto';
import {verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
/**
 * Verify a history head against an independently retained Ed25519 signature.
 * The trusted host must provision the public key outside the history file.
 * Signatures do not prove who operated the signing key or when it was signed.
 */
export function atlasHistoryAnchorMessage({headHash,count,scope}={}){
 if(typeof headHash!=='string'||!/^[a-f0-9]{64}$/.test(headHash)||
  !Number.isSafeInteger(count)||count<1||count>1000||
  typeof scope!=='string'||!/^[-a-zA-Z0-9_.\/]{1,128}$/.test(scope))
  throw Error('Invalid history anchor');
 return Buffer.from(JSON.stringify({
  domain:'atlas-evaluation-history-anchor-v1',scope,headHash,count
 }), 'utf8');
}
export function verifyAtlasHistoryAnchor({
 entries,anchor,publicKey,expectedScope
}={}){
 const history=verifyAtlasEvaluationHistory(entries);
 if(!anchor||typeof anchor!=='object'||
  anchor.headHash!==history.headHash||
  anchor.count!==history.count||
  anchor.scope!==expectedScope||
  typeof anchor.signature!=='string'||
  !/^[a-zA-Z0-9+/]+={0,2}$/.test(anchor.signature)||
  !publicKey)
  throw Error('History anchor does not match trusted context');
 const message=atlasHistoryAnchorMessage(anchor);
 const key=publicKey instanceof KeyObject&&publicKey.type==='public'?
  publicKey:createPublicKey(publicKey);
 if(key.asymmetricKeyType!=='ed25519')
  throw Error('History anchor key must be Ed25519');
 const signature=Buffer.from(anchor.signature,'base64');
 if(signature.length!==64||!cryptoVerify(null,message,key,signature))
  throw Error('History anchor signature invalid');
 return Object.freeze({
  status:'signature_verified',headHash:history.headHash,
  count:history.count,scope:expectedScope,
  externallyProvisionedKeyRequired:true,
  signerAuthorizationVerified:false,
  freshnessVerified:false,
  automaticPromotion:false
 });
}
