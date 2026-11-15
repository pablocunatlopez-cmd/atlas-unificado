# Atlas Sites: task persistence contract

The portable task ledger can now export and rehydrate validated snapshots.

```js
import {createSitesTaskLedger} from './continuous/sites-task-ledger.mjs';
import {exportSitesLedgerSnapshot,restoreSitesLedgerSnapshot} from './continuous/sites-ledger-snapshot.mjs';

const owner='verified-host-principal'; // Must come from authenticated Sites host
const ledger=createSitesTaskLedger();
ledger.create({id:'task-1',owner,goal:'Review Atlas UI'});
const serialized=JSON.stringify(exportSitesLedgerSnapshot(ledger,{owner}));
// Host stores serialized in an authenticated, access-controlled database.
// Later, after authenticating owner again:
const restored=restoreSitesLedgerSnapshot(JSON.parse(serialized),{owner});
console.log(restored.list({owner}));
```

## Critical security boundaries
- This snapshot is a **schema/transition validator**, not a cryptographic signature. A malicious writer can forge a valid history.
- Approval state must not be treated as proof that a human approved anything. The host must record trusted authorization evidence, e.g. authenticated approval event with immutable audit ID.
- The `owner` argument must come from trusted authentication, never from model-generated text or untrusted browser input.
- Snapshots contain goal text and can contain sensitive data: encrypt at rest, authorize access and apply retention policies in the host.
- The host must implement atomic storage and concurrency control; this module is not a database.
- Sites integration is not deployed, and the code in the PR has not yet been verified by the complete CI suite.

## Next step
Integrate with the actual Sites storage/authentication APIs, then add optimistic concurrency, real approval receipts and an end-to-end recovery test.
