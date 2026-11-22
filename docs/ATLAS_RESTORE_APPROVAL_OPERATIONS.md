# Atlas — Restore approval integration and operating limits

The integration test `continuous/atlas-anchored-restore-integration.test.mjs`
uses real temporary filesystem storage and concurrent claims against the
full signed-history → checkpoint → Git lookup → signed approval → local
single-use marker path. It does not perform a Git checkout or restore.

Run on Node 22 with `npm test`.

## Host requirements

1. Provision the trusted Ed25519 public keys and trusted history checkpoint
   independently from the candidate history and restore proposal.
2. Implement authorization against a trusted actor identity, not the
   `actorId` asserted in the signed request alone.
3. Use a private local directory with access controls for approval markers.
   Retain that directory across restarts; never delete markers casually.
4. Use a trusted clock and verify Git revision provenance and repository
   identity independently. A matching SHA from an injected lookup is not
   sufficient to establish trust in a remote repository.
5. Require a separate explicit human confirmation before any actual restore.
   This repository does not execute restores.

## Known limitations

- Exclusive `wx` markers coordinate only on a supported local filesystem;
  separate machines/directories and hostile local users are outside this
  guarantee.
- A failed or interrupted write may leave a partial marker. The system
  intentionally fails closed: the existing marker blocks reuse until an
  operator investigates it.
- The marker file is fsynced, but its parent directory is not fsynced;
  durability after sudden power loss is not guaranteed.
- Host-supplied adapters and clocks are trusted inputs. Test adapters are
  simulations and do not attest to a real Git server or human identity.
- Signed history continuity is only as strong as the external checkpoint,
  trusted key provisioning and checkpoint freshness.
