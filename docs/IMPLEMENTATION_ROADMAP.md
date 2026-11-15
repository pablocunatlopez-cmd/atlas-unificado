# Atlas ΩΣ → Lía: implementation roadmap

This roadmap turns the vision in [ATLAS_MASTER_OVERVIEW.md](ATLAS_MASTER_OVERVIEW.md) and [LIA_TRIAD_RUNTIME.md](LIA_TRIAD_RUNTIME.md) into a sequence of verifiable engineering work. The roadmap does not claim that planned behavior already exists.

## First: protect the current application

### P0 — Recover and validate the frontend baseline

A prior edit replaced `cloud/app/globals.css` with a short generic stylesheet. That removed most of the original global styles for the legacy workspace, learning/research pages, and shared UI. Restore the complete stylesheet from the known-good Git history before making further global-style changes.

A previous broad rewrite of `cloud/app/atlas-house.tsx` also needs a build/typecheck review against the actual interfaces in `cloud/app/house-scene.tsx`, `cloud/app/core-observatory.tsx`, and the CSS module. Do not treat the rewrite as verified: it introduced callback/prop assumptions that must be checked, and it may not compile against the current components.

Acceptance:

- Restore the original global stylesheet without dropping any of its existing sections.
- Run the Cloud app TypeScript check and production build.
- Run the existing house, process-state, creative, and UI-related tests.
- Check the home page and the existing `/chat/`, `/actividad/`, `/taller/`, music, video, research, and legacy workspace entry points.
- Record command output and distinguish a successful build from a browser QA pass.

## Product model

Keep these roles distinct in UI, code, and docs:

- **Atlas / Mente:** observes, interprets, remembers, asks and plans.
- **Ion / Cuerpo:** carries out typed, authorized actions and returns results.
- **Dios / Ícaro / Cielo / Constelación:** the horizon that connects allowed sources, collaborators and perspectives. The current resident catalog specifically describes **Ícaro** as agents and **Alba** as references.
- **Lía:** the integrated character/environment all vertices and specialists serve.
- **Specialists:** named residents such as Nora, Vera, Nilo, Talo, Zuri, Noa, Ritmo, Faro, Ada, Cota, Sol, Sigma and Ema. Their declared role does not imply a separate model or autonomous worker.

Do not assign Saggy/Siggy a role until Atlas's canonical identity/configuration or a direct, attributable session establishes it. A name match alone is not evidence.

## Incremental delivery

### P1 — Canonical identity and information architecture

1. Inventory all routes and identify whether each route is a distinct product surface, a legacy experiment, or a deep link into the same Lía experience.
2. Produce one source-of-truth identity catalog with stable IDs, vertex, room, purpose, linked process IDs, and whether the resident is operational, waiting, or purely decorative.
3. Keep the current chat engines and private histories explicit; do not silently merge data or pretend that distinct backends are the same conversation.
4. Add a visible orientation layer: “Lía is the goal; Atlas thinks, Ion acts, Ícaro/Alba connect the horizon.” Keep the three work environments and integrated Lía world navigable without renaming unrelated historical experiments.

Acceptance: every resident and route has a documented canonical purpose; no page claims capability not supported by its backing API; navigation to historical tools remains stable.

P1 progress (partial, 2026-11-15): [CHARACTER_CATALOG.md](CHARACTER_CATALOG.md) inventories the 24 current residents, maps the 13 recovered names, records the 11 additional current names without claiming they are the missing ones, and separates symbolic/technical functions. The residents panel now lists all 24 entries and focuses the selected resident. Route inventory and per-resident operational status are still pending.

### P2 — Truthful runtime visibility

1. Define a typed, versioned process event/status contract with task ID, owner scope, specialist ID, phase, timestamp, expiry, status, evidence/artefact reference, and bounded counters.
2. Have the house render only coordinator telemetry. Animations remain a visual reflection; they never create work or increment accepted-change counts.
3. Add explicit “active / waiting / stale / failed / verified” states, with the last update time and reason for waiting/failure.
4. Test stale, future-dated, disconnected, malformed and cross-scope telemetry. Unknown state must fail closed to waiting.
5. Keep polling visibility-aware, avoid overlapping requests, and ensure cleanup reliably resets request locks and aborts in-flight operations.

Acceptance: tests prove stale or invalid telemetry never authorizes a work pose or a success count; the UI accurately distinguishes “coordinator connected” from “model answered”.

### P3 — Session-bound improvement cycle

Only after P0–P2 pass:

1. Start a bounded session heartbeat while the game tab is visible and the user has explicitly enabled live work.
2. Use the existing coordinator and queue; do not start a worker/model per resident.
3. Deduplicate tasks and use leases, expiry, idempotency keys, cancellation and recovery of abandoned work.
4. Set one active improvement task initially. Give chat priority and enforce time, token/GPU, memory, network and artifact-size budgets.
5. Use a closed action registry, server-side authorization, per-user isolation, timeouts and sandboxing. Treat agent/source text as untrusted data.
6. Require external-to-generator tests and refutation criteria before promoting an artifact into Lía. Keep candidate and stable versions separate and support rollback.
7. Pause nonessential tasks when the tab is hidden, the user pauses, the heartbeat expires, the bridge disconnects or the resource budget is reached.

Acceptance: an end-to-end test demonstrates open → task claim → observe/consult → authorized action → tests → promotion or rejection → audit record; pause/close cancels or expires the task; a failing candidate cannot be integrated.

### P4 — Capability evaluation and model independence

1. Build versioned, held-out tests for language, coding, math, retrieval, memory, safety and tool use.
2. Establish baselines for the current Qwen-backed system and ATLAS-LM separately.
3. Track regression, latency, RAM/VRAM, energy/cost where measurable, uncertainty and provenance.
4. Report model weights trained, software changes, memory updates and external-model assistance as separate categories.
5. Make no universal “better than GPT/Grok/future systems” claim. Publish task-specific, reproducible comparisons and limitations.

Acceptance: a release report reproduces exact model/repository revisions, datasets, commands, hardware, sample sizes, metrics and failure cases.

### P5 — Lía's material and spatial horizon (research)

This stage is a direction, not an implemented capability. It covers:

1. **Body design:** move from decorative geometry to parametric, reviewable parts with explicit dimensions, tolerances, materials and a printable mesh. The current scene STL export is watertight per primitive and reports topology, but it is not a certified single solid or print-validated.
2. **Additive manufacturing:** validate safety, energy, maintenance and emergency-stop procedures before connecting a printer. A human authorizes every physical action.
3. **Spatial music:** add positions, spatial mixing, listening tests and a reproducible export path; do not call stereo panning "3D music".
4. **Own intelligence:** keep ATLAS-LM and any future model separate from the Lía narrative and evaluate it on external tasks.

Acceptance: none of these stages may be reported as complete until there is a reproducible artifact, an external test, a documented human authorization and a rollback path. The [evolution charter](LIA_EVOLUTION_CHARTER.md) is the current source of truth.

## Operational safety invariants

- No secrets in browser bundles, client telemetry, prompts to public services or logs.
- No arbitrary shell, filesystem, network or package-install capability from generated text.
- No remote file path access without explicit server-side authorization and path confinement.
- No promotion based solely on model consensus, passing a self-generated test, animation, task count or plausible narrative.
- Every accepted change has a source revision, artifact identity, test evidence, reviewer/authorization record and rollback target.
- If evidence is missing, display **unknown**, not success.

## Current execution status

This roadmap is a plan. The Lía identity documents are in the repository, but the live job loop described in P3 is not implemented.

P0 was completed and verified in this checkout on 2026-11-15:

- `cloud/app/globals.css` was restored from commit `94f20f6` (the complete ~97 KB stylesheet). Only the `.sr-only` utility was appended.
- `cloud/app/atlas-house.tsx` now type-checks: the JavaScript resident records used by the roster have explicit types, and `CoreObservatory` receives the `ready` prop it requires.
- A stray `.` before a `@media` query in `cloud/app/atlas-house.module.css` was removed; it generated an invalid scoped selector and failed the production build.
- The legacy `nav` element rules restored with the stylesheet were scoped to `.sidebar nav`. Unscoped, they forced `flex-direction: column` on the house room dock and on every other CSS-module navigation bar; the dock now lays out horizontally.
- `cloud/public/house/process-creatures.js` now passes the injected clock to `measuredChanges`, so retained construction marks obey the same telemetry freshness as the residents.
- `HouseScene` retries the iframe handshake until the runtime answers. A fast iframe load could previously leave the React shell disconnected, disabling teleport, pause, capture and recording while the 3D scene still rendered.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` passes in `cloud/`.
- `npm run build` completes in `cloud/`.
- The house, core, music, creative, research, cloud and studio tests pass (137 tests), including the updated coordinator-reported labels and the telemetry-expiry checks.

Browser QA was run locally on `/` and `/origen` at 1024×768: the house scene renders, the room dock lays out horizontally, the iframe handshake reports ready, PNG capture downloads a real image and the clean view hides/restores the interface. The legacy workspace loads its restored global styles and collapsed sidebar. The live Qwen bridge was not connected (local status/autonomy calls answered 502/503 and the signed-out state API answered 401), and nothing was deployed. Full interaction QA, the WebGL scene under load and the cloud deployment remain unverified.

P2 has partial, verified progress as of 2026-11-15:

- `telemetryAge` in `cloud/public/house/process-state.js` rejects missing, malformed and future-dated timestamps instead of accepting a negative age. The house now uses it for connection, resident poses and the reported change counter, so a future timestamp cannot authorize activity or keep stale counters on screen.
- The 75-second freshness window is shared by the house, the resident poses and the retained construction marks instead of being repeated as separate constants.
- The process summary now shows the age of the last signal, or “Señal con hora no válida” when the timestamp cannot be trusted. The accepted counter is hidden when the signal is not fresh.
- Tests cover fresh, expired, future, malformed and missing timestamps. TypeScript, the production build and the 138-test suite pass in this checkout.

P2 is not complete: the typed task/evidence contract, explicit failed/stale reasons in every surface, and the session-bound work heartbeat described in P3 remain unimplemented.

P2 progress (additional, 2026-11-15): the house status poll (`/api/cloud/status`) now has a hard 8-second timeout combined with the unmount AbortController (`AbortSignal.any`). A hung or slow response no longer leaves the UI in an ambiguous state; the badge flips to offline/failed and the process mirror fails closed under the existing 75 s freshness window. The tooltip distinguishes network/timeout/server failure from a clean “PC offline” signal. This closes the “hard request timeout” item of P2 for the house surface. Commit: 762e6d99ce20bed3913ba4c64cc0520db7038d35.

Memory progress (partial, 2026-11-15): manual personal notes now carry a closed scope (`global`, `resident:<id>`, `room:<id>`, `module:<id>`) and the general chat retrieves only `global` unless another scope is requested. Separately, the house records autonomous observations for the 18 workstations when `/api/cloud/status` receives fresh terminal telemetry: only `passed`/`failed`, deduplicated per 30-minute window, retained for 30 days and shown in the selected resident's card. The table is global and contains no user data; clients cannot write it. It is not learning, independent verification, personality or a background daemon. See [MEMORY_SCOPES.md](MEMORY_SCOPES.md).

Evolution charter progress (2026-11-15): `cloud/lib/lia-evolution.ts` defines Lía's purpose, non-harm priority, safety rules and capability map. The house shows it in a visible dialog, and `makeReply` answers purpose/evolution/body/3D-printing/3D-music questions with the same bounded statement. The map marks the 3D house as implemented; memory, glTF design, scene STL export and stereo music as partial; and a physical printed body, spatial music and an own general AI as research. The STL export writes millimetre ASCII triangles and a report that checks manifoldness, degenerate triangles, local solid thickness, overlaps and separate bodies; it does not validate materials, resistance or a slicer. No physical printer, print-validated body, spatial audio engine or general AI was added. See [LIA_EVOLUTION_CHARTER.md](LIA_EVOLUTION_CHARTER.md).
