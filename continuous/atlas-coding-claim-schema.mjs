import {z} from 'zod';

// Validate shape only; never interpret successful parsing as permission.
const hex64=z.string().regex(/^[a-f0-9]{64}$/);
const actor=z.string().regex(/^[a-zA-Z0-9_.@-]{1,128}$/);
export const atlasCodingClaimSchema=z.object({
 proposalId:actor,actorId:actor,
 operation:z.enum(['write','delete','execute','publish','network']),
 baseCommit:z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
 diffDigest:hex64,nonce:hex64,
 issuedAt:z.number().int().nonnegative().safe(),
 signature:z.string().min(1).max(512).regex(/^[A-Za-z0-9+/]+={0,2}$/)
}).strict();
export function parseAtlasCodingClaim(input){
 return atlasCodingClaimSchema.safeParse(input);
}
