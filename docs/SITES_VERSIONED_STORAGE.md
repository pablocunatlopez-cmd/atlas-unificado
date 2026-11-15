# Atlas Sites · Versioned task persistence

The task ledger now has a portable storage contract in `continuous/sites-versioned-ledger-store.mjs`.

## Contract
- `adapter.read(verifiedOwner)` returns `null` or `{revision,snapshot}`.
- `adapter.compareAndSwap(verifiedOwner,expectedRevision,nextRecord)` must atomically commit only when the stored revision matches, returning exactly `true` on success and `false` on conflict.
- `store.load({owner})` validates the snapshot and returns revision and task data.
- `store.save({owner,expectedRevision,snapshot})` validates data and rejects stale writes.

## Example
```js
import {createVersionedSitesLedgerStore,createMemoryCasAdapter} from './continuous/sites-versioned-ledger-store.mjs';
const store=createVersionedSitesLedgerStore(createMemoryCasAdapter()); // demo only
const {revision,snapshot}=await store.load({owner:'verified-user-id'});
const result=await store.save({owner:'verified-user-id',expectedRevision:revision,snapshot});
if(result.conflict){
  // Reload and ask the user to reconcile, never silently overwrite.
}
```

## Production requirements
- The included `createMemoryCasAdapter` is only for tests and demos: it loses all state when the process reloads.
- A real Sites storage adapter must provide atomic compare-and-swap in its backend. LocalStorage alone is insufficient for concurrent sessions.
- The owner identity must come from a verified host session, not from a model response or user-controlled field.
- An approval state is not a trusted approval receipt. Publishing or tool execution requires separate verified authorization.
- Persisted task goals may contain personal information; enforce access control, encryption, retention and deletion.
- The current modules are committed to the GitHub review branch, **not deployed into ChatGPT Sites**.
