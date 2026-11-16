/** Shared strict schema for private, local coding intent records. */
export const MAX_ATLAS_INTENT_BYTES=2048;
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const SHA=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const DIGEST=/^[a-f0-9]{64}$/;
const FIELDS='baseCommit,diffDigest,proposalId,schemaVersion,status,transactionId';
export function isAtlasCodingIntentRecord(record){
 return record!==null&&typeof record==='object'&&!Array.isArray(record)&&
  Object.keys(record).sort().join(',')===FIELDS&&record.schemaVersion===1&&
  record.status==='intent_recorded_no_commit_claim'&&
  ID.test(record.transactionId||'')&&ID.test(record.proposalId||'')&&
  SHA.test(record.baseCommit||'')&&DIGEST.test(record.diffDigest||'');
}
export function isAtlasCodingIntentFileInfo(info){
 return Boolean(info?.isFile?.()&&(info.mode&0o077)===0&&
  Number.isSafeInteger(info.size)&&info.size<=MAX_ATLAS_INTENT_BYTES);
}
