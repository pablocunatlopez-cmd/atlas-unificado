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

1. Inventory all routes and classify them as product, deep-link, legacy, or API.
2. Keep `/` as Lía's canonical home; preserve `/origen/` as legacy without branding it as the default.
3. Publish a character catalog for the 24 residents with process assignments that never invent work.

### P2 — Truthful runtime visibility

1. Define a typed, versioned process event/status contract with task ID, owner scope, specialist ID, phase, timestamp, expiry, status, evidence/artefact reference, and bounded counters.
2. Fail closed on stale or missing telemetry (freshness window + hard request timeout).
3. Explicit reason codes for disconnected / stale / no process — UI must not invent activity.
4. Typed evidence for “improvement integrated” claims; absence = unknown.

### P3 — Session-bound improvement cycle

Only after P0–P2 pass:

- Opt-in + visible tab heartbeats
- Server `liveCycleEnabled` flag
- PC gate before autonomous review work
- Evidence records after real tests — never invent integration

## Acceptance rules

- Every accepted change has a source revision, artifact identity, test evidence, reviewer/authorization record and rollback target.
- If evidence is missing, display **unknown**, not success.

## Status notes

This roadmap is a plan. The Lía identity documents are in the repository, but the live job loop described in P3 is not implemented.

P2 has partial, verified progress as of 2026-11-15:

P2 progress (additional, 2026-11-15): the house status poll (`/api/cloud/status`) now has a hard 8-second timeout combined with the unmount AbortController (`AbortSignal.any`). A hung or slow response no longer leaves the UI in an ambiguous state; the badge flips to offline/failed and the process mirror fails closed under the existing 75 s freshness window. The tooltip distinguishes network/timeout/server failure from a clean “PC offline” signal. This closes the “hard request timeout” item of P2 for the house surface. Commit: 762e6d99ce20bed3913ba4c64cc0520db7038d35.

P2 progress (evidence skeleton, 2026-11-15): `cloud/lib/evidence-contract.ts` defines `EvidenceRecord` v1 and pure `parseEvidenceRecord` / `evidenceDisplayState`. `/api/cloud/evidence` GET returns an empty list with contractVersion; POST is forbidden so the browser cannot mint verification. Integration claims still require `integratedRevision` from the coordinator. Client telemetry reasons (`REASON_LABELS`, `telemetryFreshness`) are live in `process-state.js` / `residents.js`.

Memory progress (partial, 2026-11-15): manual personal notes now carry a closed scope (`global`, `resident:<id>`, `room:<id>`, `module:<id>`) and the general chat retrieves only `global` unless another scope is requested. Separately, the house records autonomous observations for the 18 workstations when `/api/cloud/status` receives fresh terminal telemetry: only `passed`/`failed`, deduplicated per 30-minute window, retained for 30 days and shown in the selected resident's card. The table is global and contains no user data; clients cannot write it. It is not learning, independent verification, personality or a background daemon. See [MEMORY_SCOPES.md](MEMORY_SCOPES.md).

Evolution charter progress (2026-11-15): `cloud/lib/lia-evolution.ts` defines Lía's purpose, non-harm priority, safety rules and capability map. The house shows it in a visible dialog, and `makeReply` answers purpose/evolution/body/3D-printing/3D-music questions with the same bounded statement. The map marks the 3D house as implemented; memory, glTF design, scene STL export and stereo music as partial; and a physical printed body, spatial music and an own general AI as research. The STL export writes millimetre ASCII triangles and a report that checks manifoldness, degenerate triangles, local solid thickness, overlaps and separate bodies; it does not validate materials, resistance or a slicer. No physical printer, print-validated body, spatial audio engine or general AI was added. See [LIA_EVOLUTION_CHARTER.md](LIA_EVOLUTION_CHARTER.md).

### Progress log — 2026-11-15 (evening)

**P2 evidence path (code complete, deploy pending):**
- `EvidenceRecord` v1 + store + `GET/POST /api/cloud/evidence` (POST bridge-token only).
- PC: `typed-evidence-from-report.mjs`, `publish-report-evidence.mjs`, `autonomous-review` attaches `typedEvidence`.
- Bridge tick syncs latest autonomy report to Sites once per `report.at`.
- `/actividad/` `TypedEvidencePanel` polls every 15 s; empty = unknown.

**P3 session-bound cycle (pipeline ready, flags off):**
- Heartbeat contract, API, opt-in UI (house + actividad), ephemeral store.
- `ATLAS_LIVE_CYCLE_ENABLED` server flag (default false).
- PC gate `session-live-work-gate.mjs`; optional `ATLAS_ENFORCE_SESSION_LIVE_WORK` on review jobs.
- See `continuous/SESSION_LIVE_WORK.md` and `continuous/TYPED_EVIDENCE_HOOK.md`.

**Still operator steps (not code):** publish Sites; set env flags only when intentionally enabling live cycle; restart local coordinator + bridge.
