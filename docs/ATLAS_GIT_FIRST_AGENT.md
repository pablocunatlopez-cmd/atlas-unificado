# Atlas · Git-first autonomous coding workflow

The Atlas patch planner `continuous/atlas-patch-planner.mjs` adds a bounded, deterministic plan for source modifications. This follows a core lesson from Aider, OpenHands and Cline: review the change set and validate it before execution.

## Example
```js
import {planAtlasPatch} from './continuous/atlas-patch-planner.mjs';
const plan=planAtlasPatch({
 proposalId:'scene-fix-001',
 files:[{operation:'update',path:'continuous/eras-three-adapter.mjs',
   content:'// replacement file content here'}],
 checks:['syntax','unit','security','integration']
});
console.log(plan.executionStatus); // not_executed
```

## Guardrails implemented
- Explicit create/update/delete operations.
- Restricted relative paths, no traversal, no .git or node_modules writes.
- No duplicate paths in one plan.
- Limits of 50 files and 250 kB content per proposal.
- Allowlisted check names and mandatory review metadata.

## Missing before safe autonomous execution
- Authenticated user identity and host-verified approval.
- Trusted filesystem adapter with canonical-path and symlink protection.
- Repository read/write versioning and commit hash preconditions.
- Isolated process execution with CPU/memory/time/network budgets.
- Test-run attestations bound to the exact patch/commit SHA.
- Transactional patch apply, rollback and diff preview.
- LOR-ΩΣ benchmark scores and failure-memory recording.

## Security note
This planner is **not a sandbox** and does not execute any changes. Its path rules are preliminary and must not be treated as a security boundary against symlinks or encoded paths. No tests have been executed or deployment verified in this iteration.

## Next milestone
Build a repository map index and context selector, then a trusted execution backend that can apply and test changes on a separate branch. Keep GitHub PR review as the default publication path.
