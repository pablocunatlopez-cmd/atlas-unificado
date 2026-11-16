import {createPublicKey, verify, KeyObject} from 'node:crypto';

/**
 * Verify a signed, commit-bound coding approval. Pure verification only:
 * caller must supply a trusted public key and authenticated actor policy.
 * No code execution, publishing or permission is granted here.
 */
const SHA = /^[a-f0-9]{40,64}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ACTOR = /^[a-zA-Z0-9_.@-]{1,128}$/;
const OP = new Set(['write', 'delete', 'execute', 'publish', 'network']);
const MAX_AGE_MS = 300000;
const MAX_FUTURE_SKEW_MS = 30000;

export function atlasCodingApprovalMessage(claim = {}) {
  const {proposalId, actorId, operation, baseCommit, diffDigest, nonce, issuedAt} = claim;
  if (typeof proposalId !== 'string' || !ACTOR.test(proposalId) ||
      typeof actorId !== 'string' || !ACTOR.test(actorId) ||
      !OP.has(operation) || typeof baseCommit !== 'string' || !SHA.test(baseCommit) ||
      typeof diffDigest !== 'string' || !DIGEST.test(diffDigest) ||
      typeof nonce !== 'string' || !DIGEST.test(nonce) ||
      !Number.isSafeInteger(issuedAt) || issuedAt < 0) {
    throw Error('Invalid coding approval claim');
  }
  return Buffer.from(JSON.stringify({
    domain: 'atlas.coding.approval.v1', proposalId, actorId,
    operation, baseCommit, diffDigest, nonce, issuedAt
  }), 'utf8');
}

export async function verifyAtlasCodingApproval({
  claim, publicKey, expected, nowMs, authorizeActor, consumeNonce,
  maxAgeMs = MAX_AGE_MS, maxFutureSkewMs = MAX_FUTURE_SKEW_MS
} = {}) {
  if (!claim || !expected || typeof authorizeActor !== 'function' ||
      typeof consumeNonce !== 'function' || !Number.isSafeInteger(nowMs) ||
      !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 0 ||
      !Number.isSafeInteger(maxFutureSkewMs) || maxFutureSkewMs < 0) {
    throw Error('Trusted approval verification context required');
  }
  const message = atlasCodingApprovalMessage(claim);
  for (const field of ['proposalId', 'actorId', 'operation', 'baseCommit', 'diffDigest']) {
    if (claim[field] !== expected[field]) return Object.freeze({status:'blocked',reason:'target_mismatch',authorized:false});
  }
  if (claim.issuedAt > nowMs + maxFutureSkewMs ||
      nowMs - claim.issuedAt > maxAgeMs) {
    return Object.freeze({status:'blocked',reason:'expired_or_future',authorized:false});
  }
  if (typeof claim.signature !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(claim.signature) ||
      claim.signature.length > 512) {
    return Object.freeze({status:'blocked',reason:'invalid_signature',authorized:false});
  }
  const key = publicKey instanceof KeyObject && publicKey.type === 'public'
    ? publicKey : createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 key required');
  const signature = Buffer.from(claim.signature,'base64');
  if (signature.length !== 64 || !verify(null,message,key,signature)) {
    return Object.freeze({status:'blocked',reason:'invalid_signature',authorized:false});
  }
  if (await authorizeActor({actorId:claim.actorId,operation:claim.operation}) !== true) {
    return Object.freeze({status:'blocked',reason:'actor_not_authorized',authorized:false});
  }
  // Host-provided atomic durable replay protection; never trust agent-owned storage.
  if (await consumeNonce({nonce:claim.nonce,actorId:claim.actorId,
    proposalId:claim.proposalId,baseCommit:claim.baseCommit,diffDigest:claim.diffDigest}) !== true) {
    return Object.freeze({status:'blocked',reason:'nonce_not_consumed',authorized:false});
  }
  return Object.freeze({status:'verified_for_final_review',authorized:false,
    signatureVerified:true,replayClaimed:true,executesCode:false,
    note:'Independent host authorization and human approval still required'});
}
