# Atlas · Integrated coding cycle

`continuous/atlas-coding-cycle.mjs` combines the repository context map, bounded patch planner and commit-bound evidence review.

## Example
```js
import {planAtlasCodingCycle} from './continuous/atlas-coding-cycle.mjs';
const plan=planAtlasCodingCycle({
 proposalId:'eras-upgrade-1',
 repositoryFiles:[{path:'continuous/eras.mjs',content:'export const version=1;'}],
 targets:['continuous/eras.mjs'],
 changes:[{operation:'update',path:'continuous/eras.mjs',content:'export const version=2;'}]
});
console.log(plan.status); // planned_not_executed
console.log(plan.nextStep); // verify_commit_bound_evidence
```

`planAtlasCodingCycle` is planning-only. Its legacy `review` remains blocked
without checks and approval. For commit-bound evidence, call
`verifyAtlasCodingCycleEvidence({cycle, commitSha, evidence, verifyEvidence})`.
The verifier must be provided by a trusted server and bind each record to the
cycle's proposal ID, actions and exact commit SHA. A positive review still only
means ready for human review; it never executes or publishes the patch.

## Workflow boundaries
- Repository map accepts snapshots from a trusted host, not direct filesystem access.
- Patch planner only describes changes; it does not write.
- Legacy check/approval fields are not accepted as proof.
- The verified gate binds checks to the exact proposal, actions and Git commit SHA;
  authentication and CI provenance remain the trusted verifier's responsibility.
- All changes must be applied on a separate branch with rollback and human review.
- LOR-ΩΣ should compare measured outcomes before any promotion.

## Current limitations
No sandboxed test execution or production CI verifier is provided. The coding
cycle does not execute code or claim that checks ran. See
`ATLAS_TRUSTED_EVIDENCE.md` for the injected host boundary and its limitations.

## Next milestone
Connect production-authenticated verification and branch adapters; keep
publication behind explicit human approval, branch compare-and-swap and rollback.
