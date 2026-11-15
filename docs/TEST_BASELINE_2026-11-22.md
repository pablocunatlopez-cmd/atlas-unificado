# Atlas · test baseline

The filename is the requested reporting target; these results were collected
on **2026-11-15**, not on 2026-11-22. No future run is implied.

| Tree | Commit | Result | Passed | Failed | Skipped | Cancelled |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `main` | `ecb5e28a609478bf454b6b6e4c34ff1671439d1b` | 962 tests | 953 | 0 | 9 | 0 |
| Change branch, before this report | `6e0fdb2` | 965 tests | 956 | 0 | 9 | 0 |

The `main` run completed at 2026-11-15T21:37:53Z on Node v22.23.4 after
`npm ci --ignore-scripts`, using `npm test` in a temporary archive of that
commit. The branch run used the same Node version, installation command and
test command. Each run discovered 193 test files in `continuous/`.

All nine skipped tests require Acorn in the optional isolated Aider runtime.
The source test script does not measure coverage; no per-module coverage was
collected. These counts do not cover the separate cloud UI or browser tests,
and do not certify a deployment, a real CI attestation, or a rollback.
