# Atlas · Trusted evidence gate

The new `continuous/atlas-verified-evidence-gate.mjs` addresses a security weakness in the earlier review gate: accepting `approval.verifiedByHost === true` from caller-supplied data is not real authorization.

## Contract
```js
import {evaluateAtlasVerifiedChange} from './continuous/atlas-verified-evidence-gate.mjs';
const review=await evaluateAtlasVerifiedChange({
 proposalId:'fix-123',
 commitSha:'a'.repeat(40),
 actions:[{kind:'write',target:'continuous/eras.mjs'}],
 evidence:[], // trusted CI attestations and approval records
 verifyEvidence:async (item,context)=>{
  // Must authenticate and bind item to context in a trusted host service.
  return false;
 }
});
```

## Trust model
- A caller-supplied `verified` boolean is **not** proof.
- The trusted verifier must authenticate evidence origin and principal, bind results to the exact proposal and commit, enforce expiry and scope, and reject replay.
- The coding-cycle integration supplies `context.proposalDigest` for the ordered patch contents as well as `context.commitSha` and immutable actions. Other callers may omit the digest for compatibility; the gate does not enforce that a verifier actually checks it.
- The gate snapshots all evidence before awaiting the verifier to isolate it from caller mutations. Evidence must be structured-cloneable and must not contain shared memory; unsupported evidence is rejected.
- The gate only returns `readyForHumanReview`. It **never** authorizes execution or publication.
- All evidence verification is asynchronous and injected by the host; this module cannot independently prove signatures or validate GitHub Actions attestations.
- An untrusted caller must never supply its own `verifyEvidence` implementation in production.

## Execution and publication boundary
Neither this gate nor the coding cycle currently guarantees safe execution or publication. A future trusted host must address path and symlink races and verify the origin checkout; attest the runner and image; durably and atomically consume scoped approvals; enforce a compare-and-swap remote precondition; and separately test recovery from partial failures. Review readiness does not establish any of these properties or authorize execution, merging or publication.

## Required host integration
1. CI runner produces signed or API-verifiable results for exact commit SHA.
2. Trusted server validates CI results and authenticated approval.
3. A sandboxed executor applies a candidate on an isolated branch.
4. GitHub PR review remains the promotion boundary.
5. LOR-ΩΣ records regression metrics and rejected changes.

## Status
The coding cycle can invoke this primitive, but no production verifier or execution connector is provided. A verifier returning true is a host assertion, not independent proof by this module.
