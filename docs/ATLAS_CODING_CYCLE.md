# Atlas · Integrated coding cycle

`continuous/atlas-coding-cycle.mjs` combines the repository context map, bounded patch planner and verified evidence gate.

## Example
```js
import {planAtlasCodingCycle} from './continuous/atlas-coding-cycle.mjs';
const plan=await planAtlasCodingCycle({
 proposalId:'eras-upgrade-1',
 repositoryFiles:[{path:'continuous/eras.mjs',content:'export const version=1;'}],
 targets:['continuous/eras.mjs'],
 changes:[{operation:'update',path:'continuous/eras.mjs',content:'export const version=2;'}],
 commitSha:'a'.repeat(40),
 evidence:[],
 verifyEvidence:async (item,context)=>false // replace only in a trusted host
});
console.log(plan.status); // planned_not_executed
console.log(plan.nextStep); // verify_commit_bound_evidence
console.log(plan.verifiedReady); // false
```

## Workflow boundaries
- Repository map accepts snapshots from a trusted host, not direct filesystem access.
- Patch planner only describes changes; it does not write.
- `planAtlasCodingCycle` is asynchronous and requires a valid commit SHA and trusted verifier, even when evidence is empty. `planAtlasVerifiedCodingCycle` is an alias.
- Schema version 3 replaces the previous synchronous API and its caller-asserted review: callers must await the result, handle verification errors, and supply commit and verifier. Legacy `checks` and `approval` flags do not confer readiness.
- The gate receives a SHA-256 proposal digest, commit SHA and actions. `verifiedReview` reports the gate's evidence-only result; `verifiedReady` and `review.readyForReview` / `review.readyForHumanReview` also require no unresolved or conflicting files. All are advisory, not execution permission.
- The digest hashes UTF-8 `JSON.stringify({proposalId,changes})`, where `changes` is the ordered list of `{operation,path,content}` (content omitted for deletes). It identifies the submitted patch contents, not the repository snapshot or a proven Git commit. Evidence must be structured-cloneable and must not contain shared memory.
- The trusted host must independently authenticate tests and approval and bind them to this digest, the exact commit SHA and actions; this module does not verify CI results or authenticate approvals.
- All changes must be applied on a separate branch with rollback and human review.
- LOR-ΩΣ should compare measured outcomes before any promotion.

## Current limitations
No sandbox, shell execution, CI verification, authenticated approval, Sites deployment or autonomous self-modification is provided by this integration.

## Next milestone
Add a trusted verifier and GitHub execution connector with a dry-run diff, branch preconditions and explicit publication gate.
