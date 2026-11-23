# GitHub process-evidence modules in Sites

The four `process-evidence*.mjs` files are byte-identical imports from
`pablocunatlopez-cmd/atlas-unificado`, commit
`069e38b9ad890f3ef58ee4f0689917372a1367e1`. Their hashes are recorded in
`github-evidence-provenance.json`. The historical source documents remain
separate from claims about the current deployed runtime.

These modules inspect the shape and consistency of an evidence **report**.
They do not authenticate its producer, execute its tests or independently
verify that a change was integrated. `consistent_report` remains `reported`.

The Sites adapter is `lib/collaboration/house-evidence.ts`. It gates recording
of bounded runtime artifacts on valid checks and a coherent report. A first
draft may be stored without claiming a comparative improvement; a changed
hash or a repeated test cannot manufacture a promotion. Reports do not gain
an `integration` field from the browser or a model assertion.

Run the source checks and adapter regressions from the Sites checkout:

```sh
node continuous/process-evidence.test.mjs
node continuous/process-evidence-review.test.mjs
node --experimental-strip-types tests/atlas-house-evidence.test.mts
```
