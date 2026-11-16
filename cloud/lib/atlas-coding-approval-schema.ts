import {z} from 'zod';

/**
 * Cloud-side shape validation for proposed coding approvals.
 * Parsing is NOT signature verification, authentication or permission.
 * Server must independently verify Ed25519 signature and host policy.
 */
const sha256=z.string().regex(/^[a-f0-9]{64}$/);
const actor=z.string().regex(/^[a-zA-Z0-9_.@-]{1,128}$/);
export const codingApprovalClaimSchema=z.object({
 proposalId:actor,
 actorId:actor,
 operation:z.enum(['write','delete','execute','publish','network']),
 baseCommit:z.string().regex(/^[a-f0-9]{40}$|^[a-f0-9]{64}$/),
 diffDigest:sha256,
 nonce:sha256,
 issuedAt:z.number().int().nonnegative().safe(),
 signature:z.string().min(1).max(512).regex(/^[A-Za-z0-9+/]+={0,2}$/)
}).strict();

export function parseCodingApprovalClaim(value:unknown){
 return codingApprovalClaimSchema.safeParse(value);
}
