# Atlas · Integrated coding cycle

`continuous/atlas-coding-cycle.mjs` combines the repository context map, bounded patch planner and agent change review gate.

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
console.log(plan.nextStep); // run_tests_in_trusted_executor
```

## Workflow boundaries
- Repository map accepts snapshots from a trusted host, not direct filesystem access.
- Patch planner only describes changes; it does not write.
- Review gate checks caller-provided evidence; it does not verify CI results or authenticate approvals.
- Host must bind tests and approval to exact proposal digest and Git commit SHA.
- All changes must be applied on a separate branch with rollback and human review.
- LOR-ΩΣ should compare measured outcomes before any promotion.

## Current limitations
No sandbox, shell execution, CI verification, authenticated approval, Sites deployment or autonomous self-modification is provided by this integration. Tests are committed but have not been executed in this iteration.

## Next milestone
Add a signed/verified evidence protocol and a trusted GitHub execution connector with a dry-run diff, branch preconditions and explicit publication gate.
